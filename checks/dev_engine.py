"""Disposable real engine + simulator for the UI's own browser checks."""
import json
import os
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.run_engine import seed

processes = []
with tempfile.TemporaryDirectory(prefix='aqef-ui-e2e-') as directory:
    # Isolate Human/Judge UI fixtures before any suite starts. Keep the sample
    # files untouched and retain the real 200ms check on the slow Scenario.
    workspace = Path(directory) / 'workspace'
    shutil.copytree(ROOT / 'examples/aster', workspace)
    source = workspace / 'project.yaml'
    fixture = yaml.safe_load(source.read_text(encoding='utf-8'))
    project = fixture['project']
    quality = next(c for c in project['contracts'] if c['name'] == 'support-quality')
    latency = next(c for c in quality['constraints'] if c['id'] == 'response-latency')
    assert latency['expected'] == 200
    quality['constraints'] = [c for c in quality['constraints'] if c['id'] != latency['id']]
    suite = next(s for s in project['suites'] if s['name'] == 'support-behaviours')
    slow = next(s for s in suite['scenarios'] if s['name'] == 'slow-response')
    slow.setdefault('contract', {}).setdefault('constraints', []).append(latency)
    source.write_text(yaml.safe_dump(fixture, sort_keys=False, allow_unicode=True), encoding='utf-8')
    env = dict(os.environ)
    env['AQEF_DB_PATH'] = str(Path(directory) / 'engine.db')
    env['PYTHONPATH'] = str(ROOT / 'vendor/engine')
    providers = json.loads((ROOT / 'config/providers.json').read_text())
    env['AQEF_PROVIDER_URLS'] = json.dumps({k: v.replace('aster-sim', '127.0.0.1', 1) for k, v in providers.items()})
    def fixture_server(module, *arguments):
        # Windows can refuse a burst of connections to the stdlib's five-slot
        # listen queue when all test services share one CPU. This is transport
        # capacity only, scoped to these disposable fixture processes.
        launch = ("import runpy; from http.server import ThreadingHTTPServer; "
                  "ThreadingHTTPServer.request_queue_size = 128; "
                  f"runpy.run_module({module!r}, run_name='__main__')")
        return subprocess.Popen([sys.executable, '-c', launch, *arguments], cwd=ROOT, env=env)
    try:
        processes.append(fixture_server('sim.server'))
        processes.append(fixture_server('workspace_service.server', '--root', str(workspace)))
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
        seed('http://127.0.0.1:8000', env['AQEF_ADMIN_TOKEN'], workspace)
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
