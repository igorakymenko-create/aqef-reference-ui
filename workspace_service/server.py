"""Local confined YAML store: syntax, secret-key guard and optimistic writes only."""
import argparse
from contextlib import contextmanager
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import threading
from urllib.parse import parse_qs, urlsplit
import uuid

import yaml

FORBIDDEN = {'password', 'api_key', 'token', 'secret'}


class FileError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def syntax_and_secrets(content):
    try:
        documents = list(yaml.safe_load_all(content))
    except yaml.YAMLError as exc:
        mark = getattr(exc, 'problem_mark', None)
        position = f' at line {mark.line + 1}, column {mark.column + 1}' if mark else ''
        raise FileError(422, 'Invalid YAML syntax' + position) from None
    seen = set()
    def walk(value):
        if isinstance(value, (dict, list)):
            if id(value) in seen: return
            seen.add(id(value))
        if isinstance(value, dict):
            for key, child in value.items():
                if str(key).lower() in FORBIDDEN:
                    raise FileError(422, 'Secret-value keys are forbidden; use secret_ref instead. No value was stored.')
                walk(child)
        elif isinstance(value, list):
            for child in value: walk(child)
    for document in documents: walk(document)


def etag(content):
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


class Workspace:
    def __init__(self, root, seed=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        if seed and not any(self.root.iterdir()):
            for source in sorted(Path(seed).rglob('*')):
                if source.is_file() and not source.is_symlink() and source.suffix.lower() in ('.yaml', '.yml'):
                    content = source.read_text(encoding='utf-8')
                    syntax_and_secrets(content)
                    destination = self.root / source.relative_to(seed)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_text(content, encoding='utf-8')

    def parts(self, name):
        if not name or '\\' in name or ':' in name or '\x00' in name:
            raise FileError(400, 'Only relative YAML paths inside the workspace are allowed')
        parts = name.split('/')
        if any(p in ('', '.', '..') for p in parts) or PurePosixPath(name).is_absolute() or Path(name).suffix.lower() not in ('.yaml', '.yml'):
            raise FileError(400, 'Only relative YAML paths inside the workspace are allowed')
        path = self.root
        for part in parts:
            path /= part
            if path.is_symlink() or not path.resolve().is_relative_to(self.root):
                raise FileError(403, 'Symlinks and paths outside the workspace are forbidden')
        return parts

    @contextmanager
    def parent(self, name, create=False):
        parts = self.parts(name)
        if os.open in os.supports_dir_fd and hasattr(os, 'O_NOFOLLOW'):
            # Linux deployment: directory-relative operations prevent symlink-swap races.
            fd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                for part in parts[:-1]:
                    if create:
                        try: os.mkdir(part, dir_fd=fd)
                        except FileExistsError: pass
                    next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
                    os.close(fd); fd = next_fd
                yield fd, parts[-1]
            finally: os.close(fd)
        else:
            path = self.root.joinpath(*parts)
            if create: path.parent.mkdir(parents=True, exist_ok=True)
            self.parts(name)
            yield None, path

    def _read(self, parent, leaf):
        flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
        fd = os.open(leaf, flags, dir_fd=parent)
        with os.fdopen(fd, 'r', encoding='utf-8') as stream:
            import stat
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise FileError(403, 'Only regular YAML files are supported')
            content = stream.read(2_000_001)
        if len(content) > 2_000_000: raise FileError(413, 'YAML file exceeds 2 MB')
        return content

    def read(self, name):
        with self.lock, self.parent(name) as (parent, leaf):
            content = self._read(parent, leaf)
            syntax_and_secrets(content)
            return {'path': name, 'content': content, 'etag': etag(content)}

    def write(self, name, content, expected):
        if not isinstance(content, str) or len(content.encode('utf-8')) > 2_000_000:
            raise FileError(413, 'YAML file exceeds 2 MB or is not text')
        syntax_and_secrets(content)
        with self.lock, self.parent(name, create=True) as (parent, leaf):
            try: current = etag(self._read(parent, leaf))
            except FileNotFoundError: current = None
            if current != expected:
                raise FileError(409, 'File changed on disk; reload and review the new diff before saving')
            temporary = f'.workspace-{uuid.uuid4().hex}.tmp' if parent is not None else leaf.with_name(f'.workspace-{uuid.uuid4().hex}.tmp')
            try:
                fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=parent)
                with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
                    stream.write(content); stream.flush(); os.fsync(stream.fileno())
                self.parts(name)
                os.replace(temporary, leaf, src_dir_fd=parent, dst_dir_fd=parent)
            finally:
                try: os.unlink(temporary, dir_fd=parent)
                except FileNotFoundError: pass
            return {'path': name, 'etag': etag(content)}

    def files(self):
        with self.lock:
            return sorted(p.relative_to(self.root).as_posix() for p in self.root.rglob('*')
                if p.is_file() and not p.is_symlink() and p.suffix.lower() in ('.yaml', '.yml')
                and all(not parent.is_symlink() for parent in p.parents if parent != self.root.parent))


def handler(store):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_): pass
        def reply(self, status, data):
            body = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers(); self.wfile.write(body)
        def run_request(self, write=False):
            try:
                url = urlsplit(self.path)
                if not write and url.path == '/healthz': return self.reply(200, {'status': 'ok'})
                if url.path != '/files': return self.reply(404, {'detail': 'Not found'})
                name = parse_qs(url.query).get('path', [None])[0]
                if not write: return self.reply(200, store.read(name) if name else {'files': store.files()})
                # Browser requests use an exact JSON media type. Cross-origin form writes are refused.
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise FileError(415, 'Writes require application/json')
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length < 3_000_000: raise FileError(413, 'Request too large or empty')
                body = json.loads(self.rfile.read(length))
                if 'expected_etag' not in body: raise FileError(428, 'expected_etag is required (null for a new file)')
                self.reply(200, store.write(name, body['content'], body['expected_etag']))
            except FileError as exc: self.reply(exc.status, {'detail': exc.message})
            except FileNotFoundError: self.reply(404, {'detail': 'YAML file or directory not found'})
            except (OSError, UnicodeError): self.reply(403, {'detail': 'File access refused; only regular YAML paths within the workspace are allowed'})
            except (ValueError, TypeError, KeyError): self.reply(400, {'detail': 'Invalid file request'})
        def do_GET(self): self.run_request()
        def do_PUT(self): self.run_request(write=True)
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='workspace')
    parser.add_argument('--seed', default='examples/aster')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=9200)
    args = parser.parse_args()
    ThreadingHTTPServer((args.host, args.port), handler(Workspace(args.root, args.seed))).serve_forever()
