"""Disposable real engine + simulator for the UI's own browser checks."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.run_engine import seed

processes = []
with tempfile.TemporaryDirectory(prefix='aqef-ui-e2e-') as directory:
    env = dict(os.environ)
    env['AQEF_DB_PATH'] = str(Path(directory) / 'engine.db')
    env['PYTHONPATH'] = str(ROOT / 'vendor/engine')
    providers = json.loads((ROOT / 'config/providers.json').read_text())
    env['AQEF_PROVIDER_URLS'] = json.dumps({k: v.replace('aster-sim', '127.0.0.1', 1) for k, v in providers.items()})
    try:
        processes.append(subprocess.Popen([sys.executable, '-m', 'sim.server'], cwd=ROOT, env=env))
        processes.append(subprocess.Popen([sys.executable, '-m', 'workspace_service.server', '--root', str(Path(directory)/'workspace')], cwd=ROOT, env=env))
        processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'engine.main:app', '--host', '127.0.0.1', '--port', '8000'], cwd=ROOT, env=env))
        for _ in range(100):
            if any(p.poll() is not None for p in processes): raise RuntimeError('Local check dependency exited')
            try:
                request = urllib.request.Request('http://127.0.0.1:8000/healthz', headers={'Authorization': 'Bearer ' + env['AQEF_ADMIN_TOKEN']})
                urllib.request.urlopen(request, timeout=1).close()
                urllib.request.urlopen('http://127.0.0.1:9100/healthz', timeout=1).close()
                urllib.request.urlopen('http://127.0.0.1:9200/healthz', timeout=1).close()
                break
            except urllib.error.URLError: time.sleep(.2)
        else: raise RuntimeError('Local check dependencies did not become ready')
        seed('http://127.0.0.1:8000', env['AQEF_ADMIN_TOKEN'], ROOT / 'examples/aster')
        # Readiness belongs to this disposable launcher, not to the engine API.
        from http.server import BaseHTTPRequestHandler, HTTPServer
        class Ready(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.end_headers(); self.wfile.write(b'ready')
            def log_message(self, *_): pass
        HTTPServer(('127.0.0.1', 9191), Ready).serve_forever()
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try: process.wait(timeout=5)
            except subprocess.TimeoutExpired: process.kill(); process.wait()
