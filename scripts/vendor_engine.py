"""Copy only named engine sources from the verified pin, never test material."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
commit = '83c69e0defafe94e7f05282a1c2dd02c1d993d9e'


def git(*args):
    return subprocess.check_output(['git', '-C', str(source), *args])


paths = git('ls-tree', '-r', '--name-only', commit, '--', 'engine', 'requirements.txt', 'LICENSE').decode().splitlines()
hashes = {}
for name in paths:
    if name != 'requirements.txt' and name != 'LICENSE' and not (name.startswith('engine/') and name.endswith('.py')):
        continue
    data = git('show', f'{commit}:{name}')
    target = root / 'vendor/engine' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    hashes[name] = hashlib.sha256(data).hexdigest()
docs = root / 'docs'
docs.mkdir(exist_ok=True)
(docs / 'engine-openapi.json').write_bytes(git('show', f'{commit}:docs/OPENAPI.json'))
(root / 'LICENSE').write_bytes(git('show', f'{commit}:LICENSE'))
(docs / 'ENGINE-SOURCE.json').write_text(json.dumps({
    'repository': 'https://github.com/igorakymenko-create/aqef-reference-engine',
    'tag': 'slice-12', 'commit': commit,
    'note': 'Unmodified Python package only; no engine tests or external test materials copied.',
    'sha256': hashes,
}, indent=2) + '\n', encoding='utf-8')
print(f'Vendored {len(hashes)} pinned source files; OpenAPI snapshot and Apache 2.0 licence copied.')
