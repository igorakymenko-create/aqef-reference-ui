import os
from pathlib import Path
import urllib.request

if not Path('/tmp/aqef-ui-ready').is_file():
    raise SystemExit(1)
request = urllib.request.Request('http://127.0.0.1:8000/healthz', headers={
    'Authorization': 'Bearer ' + os.environ['AQEF_ADMIN_TOKEN']})
urllib.request.urlopen(request, timeout=2).close()
