"""Independent file-service checks: no AQEF schemas or decisions in this service."""
import json
from pathlib import Path
import tempfile
import unittest
from workspace_service.server import Workspace, FileError


class WorkspaceFiles(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)/'workspace'
        self.store=Workspace(self.root)
    def tearDown(self): self.temp.cleanup()

    def test_syntax_only_storage_and_optimistic_write(self):
        # Intentionally not a valid AQEF document; service must not know that.
        first=self.store.write('nested/anything.yaml','arbitrary: [one, two]\n',None)
        self.assertEqual(self.store.read('nested/anything.yaml')['content'],'arbitrary: [one, two]\n')
        self.assertEqual(self.store.files(),['nested/anything.yaml'])
        with self.assertRaises(FileError) as conflict:
            self.store.write('nested/anything.yaml','arbitrary: three\n',None)
        self.assertEqual(conflict.exception.status,409)
        self.store.write('nested/anything.yaml','arbitrary: three\n',first['etag'])
        with self.assertRaises(FileError): self.store.write('broken.yaml','bad: [unterminated',None)
        self.assertFalse((self.root/'broken.yaml').exists())

    def test_secret_keys_in_nested_flow_documents_and_aliases(self):
        for content in ['password: hidden-value','nested: {API_KEY: hidden-value}','a: &a {Token: hidden-value}\nb: *a','ok: yes\n---\nsecret: hidden-value']:
            with self.subTest(content=content):
                with self.assertRaises(FileError) as error: self.store.write('secret.yaml',content,None)
                self.assertIn('secret_ref',error.exception.message)
                self.assertNotIn('hidden-value',error.exception.message)
        self.store.write('reference.yaml','secret_ref: SERVICE_CREDENTIAL\n',None)
        self.assertIn('SERVICE_CREDENTIAL',self.store.read('reference.yaml')['content'])

    def test_paths_and_external_symlinks(self):
        for path in ['../outside.yaml','/tmp/outside.yaml','C:/outside.yaml','a/../../outside.yaml','a\\outside.yaml','a/./b.yaml','.env']:
            with self.subTest(path=path):
                with self.assertRaises(FileError): self.store.write(path,'safe: yes',None)
        outside=Path(self.temp.name)/'outside';outside.mkdir();(outside/'private.yaml').write_text('private: data')
        try: (self.root/'link').symlink_to(outside,target_is_directory=True)
        except OSError: self.skipTest('Windows account cannot create symlinks; this check also runs inside the Linux workspace container')
        with self.assertRaises(FileError): self.store.read('link/private.yaml')
        with self.assertRaises(FileError): self.store.write('link/new.yaml','safe: yes',None)
        self.assertNotIn('link/private.yaml',self.store.files())
        self.assertFalse((outside/'new.yaml').exists())

    def test_seed_only_empty_folder(self):
        seed=Path(self.temp.name)/'seed';seed.mkdir();(seed/'sample.yaml').write_text('sample: original\n')
        first=Workspace(self.root,seed)
        saved=first.read('sample.yaml');first.write('sample.yaml','sample: edited\n',saved['etag'])
        second=Workspace(self.root,seed)
        self.assertEqual(second.read('sample.yaml')['content'],'sample: edited\n')


if __name__=='__main__': unittest.main()
