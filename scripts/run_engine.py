"""Start the unmodified pinned engine; seed only a missing sample via its REST API."""
import json
import hashlib
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request

import yaml

ROOT = Path(__file__).resolve().parents[1]

def local_person_token(token):
    return hashlib.sha256((token + ':aqef-reference-ui-person-v1').encode()).hexdigest()

def bootstrap_person(base, token):
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    def call(path, data=None):
        req = urllib.request.Request(base + path, headers=headers, data=None if data is None else json.dumps(data).encode())
        try:
            with urllib.request.urlopen(req, timeout=5) as response: return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code != 409: raise RuntimeError(f'Local Person bootstrap rejected: HTTP {exc.code}') from None
    roles = call('/roles?limit=1000')
    admin = next((r for r in roles if r['name'] == 'admin'), None)
    if not admin or not {'read', 'execute', 'review'}.issubset(admin['permissions']):
        raise RuntimeError('Local admin Role lacks sample read/execute/review permissions; no Role weakened or overwritten.')
    role = next((r for r in roles if r['name'] == 'aster-reviewer'), None)
    if role is None: call('/roles', {'name': 'aster-reviewer', 'permissions': ['read', 'review']})
    elif not {'read', 'review'}.issubset(role['permissions']): raise RuntimeError('Existing aster-reviewer Role lacks required permissions')
    call('/principals', {'id': 'aster-local-person', 'kind': 'person', 'name': 'Local Aster operator', 'roles': ['admin', 'aster-reviewer'], 'token': local_person_token(token)})
    # Verify the derived credential is accepted without exposing it or updating a Principal.
    req = urllib.request.Request(base + '/roles?limit=1', headers={'Authorization': 'Bearer ' + local_person_token(token)})
    urllib.request.urlopen(req, timeout=5).close()


def seed(base, token, workspace):
    bootstrap_person(base, token)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    data = yaml.safe_load((Path(workspace) / "project.yaml").read_text(encoding="utf-8"))["project"]
    from urllib.parse import quote
    request = urllib.request.Request(f'{base}/projects/{quote(data["name"], safe="")}', headers=headers)
    try:
        urllib.request.urlopen(request, timeout=5).close()
        print("Existing Aster Project preserved; no configuration or history overwritten.", flush=True)
        return
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    request = urllib.request.Request(f"{base}/projects", data=json.dumps(data).encode(), headers=headers, method="POST")
    try:
        urllib.request.urlopen(request, timeout=10).close()
    except urllib.error.HTTPError as exc:
        # Engine error body is safe here: sample inputs contain no credentials.
        raise RuntimeError(f"Sample import rejected: HTTP {exc.code}: {exc.read().decode()}") from None
    print("Aster YAML loaded through the engine REST API (Person admin; governed Audit recorded).", flush=True)


def main():
    token = os.environ["AQEF_ADMIN_TOKEN"]
    # One authoritative deployment mapping, also displayed read-only by Connections.
    os.environ["AQEF_PROVIDER_URLS"] = (ROOT / "config/providers.json").read_text()
    ready = Path("/tmp/aqef-ui-ready")
    ready.unlink(missing_ok=True)
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "engine.main:app", "--host", "0.0.0.0", "--port", "8000"])
    signal.signal(signal.SIGTERM, lambda *_: process.terminate())
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Engine exited before becoming ready")
            try:
                request = urllib.request.Request("http://127.0.0.1:8000/healthz", headers={"Authorization": f"Bearer {token}"})
                urllib.request.urlopen(request, timeout=1).close()
                break
            except urllib.error.URLError:
                time.sleep(.2)
        else:
            raise RuntimeError("Engine startup timed out")
        seed("http://127.0.0.1:8000", token, "/workspace")
        ready.touch()
        sys.exit(process.wait())
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=10)


if __name__ == "__main__":
    main()
