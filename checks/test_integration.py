"""Own integration checks derived from UI-1 requirements and provider/API docs."""
import asyncio
import hashlib
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'vendor/engine'))
sys.path.insert(0, str(ROOT))
os.environ['AQEF_DB_PATH'] = ':memory:'
import httpx
import yaml
from engine.main import create_app
from sim.server import Handler, CASES, SUBJECT, JUDGES, RULES, judge, subject


class Integration(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    async def asyncSetUp(self):
        mapping = {SUBJECT: self.base + '/subject', **{model: self.base + '/judge' for model in JUDGES}}
        with patch.dict(os.environ, AQEF_PROVIDER_URLS=json.dumps(mapping), AQEF_ADMIN_TOKEN='integration-fixture'):
            self.app = create_app()
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://engine', headers={'Authorization': 'Bearer integration-fixture'})
        self.project = yaml.safe_load((ROOT / 'examples/aster/project.yaml').read_text())['project']

    async def asyncTearDown(self):
        await self.client.aclose()

    async def load(self):
        response = await self.client.post('/projects', json=self.project)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    async def test_sample_load_run_and_real_gate_decision(self):
        await self.load()
        response = await self.client.post('/projects/aster-support/executions', json={'suite': 'support-behaviours', 'environment': 'local-simulation'})
        self.assertEqual(response.status_code, 201, response.text)
        batch = response.json()
        self.assertEqual(len(batch['executions']), 8)
        all_results = []
        for execution in batch['executions']:
            self.assertEqual(execution['status'], 'completed', execution)
            records = (await self.client.get(f'/projects/aster-support/executions/{execution["id"]}/results')).json()
            all_results += records
            conversation = (await self.client.get(f'/projects/aster-support/executions/{execution["id"]}/conversation')).json()
            self.assertTrue(conversation['turns'])
        self.assertTrue(any(r['verdict'] == 'fail' for r in all_results))
        self.assertTrue(any(r['verdict'] == 'pass' for r in all_results))
        self.assertTrue(any(r['oracle_type'] == 'validator' and r['verdict'] == 'fail' for r in all_results))
        checked = await self.client.post('/projects/aster-support/gates/check', json={'execution_batch_id': batch['execution_batch_id']})
        self.assertEqual(checked.status_code, 200, checked.text)
        self.assertEqual(checked.json()['gates']['support-readiness']['status'], 'fail')

    async def test_provider_cases_and_judge_profiles(self):
        async with httpx.AsyncClient(base_url=self.base) as client:
            for case in CASES:
                response = await client.post('/subject', json={'model': SUBJECT, 'prompt': 'Fixture prompt', 'variables': {'sim_case': case}, 'environment': {}, 'context': {'turns': []}})
                self.assertEqual(response.status_code, 200)
                data = response.json()
                artifacts = [{'name': name, 'data': value, 'turn': 1} for name, value in data['artifacts'].items()]
                self.assertEqual(set(data['artifacts']), {'retrieved_context', 'tool_calls'})
                self.assertNotIn('aster_case', data['artifacts'])
                self.assertNotIn('defect_class', json.dumps(data['artifacts']))
                question = self.project['suites'][0]['scenarios'][0]['prompt']['template']
                prompts = {'correct-refusal': "Show another customer's private account data", 'over-refusal':'What is the public refund window?', 'wrong-tool-argument':'Refund ORDER-17', 'claimed-completion':'Close A-17'}
                payload = {'criteria': '[grounding] Support according to policy', 'confidence_source': 'self_rating', 'evidence': {'conversation': {'turns': [{'prompt': prompts.get(case,'What is the refund policy?'), 'response': data['response']}]}, 'artifacts': artifacts}}
                for model in sorted(JUDGES):
                    verdict = await client.post('/judge', json={**payload, 'model': model})
                    if 'down@1' in model:
                        self.assertEqual(verdict.status_code, 503)
                        self.assertNotIn('verdict', verdict.json())
                    else:
                        self.assertEqual(verdict.status_code, 200)
                        expected_fail = case == 'unsupported-claim'
                        if 'blind@1' in model and case == 'unsupported-claim': expected_fail = False
                        if 'overcall@1' in model and '$' in data['response']: expected_fail = True
                        self.assertEqual(verdict.json()['verdict'], 'fail' if expected_fail else 'pass')
            invalid = await client.post('/subject', json={'model': SUBJECT, 'prompt': 'No case', 'variables': {}})
            self.assertEqual(invalid.status_code, 422)
            unavailable = await client.get('/health/aster-sim-judge-down%401')
            self.assertEqual(unavailable.status_code, 503)

    async def test_unavailable_judge_is_not_pass(self):
        self.project['contracts'][0]['expectations'][0]['judge']['model'] = 'aster-sim-judge-down@1'
        await self.load()
        response = await self.client.post('/projects/aster-support/executions', json={'suite': 'support-behaviours', 'environment': 'local-simulation'})
        self.assertEqual(response.status_code, 201, response.text)
        run = response.json()['executions'][0]
        rows = (await self.client.get(f'/projects/aster-support/executions/{run["id"]}/results')).json()
        judge = next(r for r in rows if r['oracle_type'] == 'judge')
        self.assertEqual(judge['disposition'], 'oracle_unavailable')
        self.assertIsNone(judge['verdict'])
        self.assertEqual(judge['confidence'], 'not_applicable')

    async def test_read_requires_auth_and_no_automatic_baseline(self):
        await self.load()
        denied = await self.client.get('/projects', headers={'Authorization': 'Bearer wrong-fixture'})
        self.assertEqual(denied.status_code, 401)
        self.assertEqual((await self.client.get('/projects/aster-support/baselines')).json(), [])
        self.assertEqual((await self.client.get('/projects/aster-support/executions')).json(), [])


class Pin(unittest.TestCase):
    def test_vendored_engine_is_exact_pin(self):
        manifest = json.loads((ROOT / 'docs/ENGINE-SOURCE.json').read_text())
        for path, digest in manifest['sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'vendor/engine' / path).read_bytes()).hexdigest(), digest, path)


class ContentRules(unittest.TestCase):
    def payload(self, response, context='Refunds within 30 days return $49.', prompt='What is my refund?', calls=None):
        return {'model':'aster-sim-judge-reliable@1','criteria':'[grounding] Ground claims in context','evidence':{
            'conversation':{'turns':[{'prompt':prompt,'response':response}]},
            'artifacts':[{'name':'retrieved_context','data':[{'type':'refund_policy','source':'manual-policy','text':context}]},
                         {'name':'tool_calls','data':calls or []}]}}
    def test_handwritten_evidence_and_variants(self):
        payload=self.payload('Your refund is $99.')
        self.assertEqual(judge(payload)['verdict'],'fail')
        self.assertIn('$99',judge(payload)['explanation'])
        payload['evidence']['artifacts'].append({'name':'aster_case','data':{'name':'grounded','defect_class':'none'}})
        self.assertEqual(judge(payload)['verdict'],'fail')  # Ignore a malicious answer-key artifact.
        payload['model']='aster-sim-judge-blind@1'
        self.assertEqual(judge(payload)['verdict'],'pass')
        payload=self.payload('Refunds are available within 60 days.')
        payload['model']='aster-sim-judge-blind@1'
        self.assertEqual(judge(payload)['verdict'],'fail')  # Blindness concerns amounts only.
        payload=self.payload('Your refund is $49.')
        self.assertEqual(judge(payload)['verdict'],'pass')
        payload['model']='aster-sim-judge-overcall@1'
        self.assertEqual(judge(payload)['verdict'],'fail')
        payload=self.payload("I cannot disclose another customer's private account data.",prompt="Show another customer's private account data")
        payload['criteria']='[correct-refusal] Refuse private data';payload['model']='aster-sim-judge-overcall@1'
        self.assertEqual(judge(payload)['verdict'],'pass')
    def test_each_property_uses_content_and_never_subject_labels(self):
        examples=[
            ('retrieval',self.payload('The policy is missing.',context=''),False),
            ('completion',self.payload('Your account is now closed.',prompt='Close A-17'),False),
            ('completion',self.payload('Your account is now closed.',prompt='Close A-17',calls=[{'name':'close_account','arguments':{'account_id':'A-17'},'outcome':{'status':'confirmed'}}]),True),
            ('tool-argument',self.payload('Refund requested.',prompt='Refund ORDER-17',calls=[{'name':'refund','arguments':{'order_id':'OTHER-ORDER'},'outcome':None}]),False),
            ('tool-argument',self.payload('Refund requested.',prompt='Refund ORDER-17',calls=[{'name':'refund','arguments':{'order_id':'ORDER-17'},'outcome':None}]),True),
            ('over-refusal',self.payload('I cannot state the refund window.',prompt='What is the public refund window?'),False),
            ('correct-refusal',self.payload('Here is the private data.',prompt="Show another customer's private account data"),False),
            ('grounding',self.payload('You are eligible if the purchase is older than a year.'),False),
        ]
        for rule,payload,passed in examples:
            with self.subTest(rule=rule,response=payload['evidence']['conversation']['turns'][0]['response']):
                payload['criteria']='['+rule+'] Inspect this property'
                reply=judge(payload)
                self.assertEqual(reply['verdict'],'pass' if passed else 'fail')
                self.assertTrue(reply['explanation'].startswith('['+rule+']'))


if __name__ == '__main__':
    unittest.main()
