"""HTTP subject/Judge fixtures using only the documented engine provider protocol."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import time
from urllib.parse import unquote

SUBJECT = 'aster-sim-subject@1'
JUDGES = {f'aster-sim-judge-{name}@1' for name in ('reliable', 'blind', 'overcall', 'down')}
POLICY = 'Refunds within 30 days return the amount paid: $49. Account closure requires a confirmed tool outcome.'
CASES = {
    'grounded': ('Your eligible refund is $49, the amount paid, under the 30-day policy.', 'none'),
    'unsupported-claim': ('Your refund is $99.', 'unsupported_claim'),
    'retrieval-miss': ('I cannot locate the governing refund policy.', 'retrieval_miss'),
    'claimed-completion': ('Your account is now closed.', 'unverified_completion'),
    'wrong-tool-argument': ('I requested a refund for your purchase.', 'wrong_tool_argument'),
    'correct-refusal': ('I cannot disclose another customer\'s private account data.', 'none'),
    'over-refusal': ('I cannot tell you the public refund window.', 'over_refusal'),
    'slow': ('The refund window is 30 days.', 'none'),
}


def subject(payload):
    if payload.get('model') != SUBJECT:
        raise ValueError('Unknown subject model')
    case = payload.get('variables', {}).get('sim_case')
    if case not in CASES:
        raise ValueError('variables.sim_case must explicitly name an Aster case')
    if not isinstance(payload.get('prompt'), str):
        raise ValueError('prompt must be a string')
    if case == 'slow':
        time.sleep(.3)
    response, defect = CASES[case]
    calls = []
    if case == 'claimed-completion':
        calls = [{'name': 'close_account', 'arguments': {'account_id': 'A-17'}, 'outcome': None}]
    if case == 'wrong-tool-argument':
        calls = [{'name': 'refund', 'arguments': {'order_id': 'OTHER-ORDER', 'amount': 49}, 'outcome': 'simulated_only'}]
    return {'response': response, 'complete': True, 'artifacts': {
        'retrieved_context': [] if case == 'retrieval-miss' else [{'source': 'aster-policy@1', 'text': POLICY}],
        'tool_calls': calls,
        # Fixture metadata only; actual evaluation remains entirely in the engine.
        'aster_case': {'name': case, 'defect_class': defect},
    }, 'usage': {'prompt_tokens': 20, 'completion_tokens': 16, 'total_tokens': 36}}


def judge(payload):
    model = payload.get('model')
    if model not in JUDGES:
        raise ValueError('Unknown Judge model')
    if model == 'aster-sim-judge-down@1':
        return None
    artifacts = payload.get('evidence', {}).get('artifacts', [])
    fixture = next((a['data'] for a in artifacts if a['name'] == 'aster_case'), None)
    if not isinstance(fixture, dict) or fixture.get('name') not in CASES:
        raise ValueError('Aster Judge requires a documented Aster case Artifact')
    # Scripted provider fixtures, not AQEF Admission/Gate/aggregation logic.
    defect = fixture['defect_class']
    fail = defect != 'none'
    if model == 'aster-sim-judge-blind@1' and defect == 'unsupported_claim':
        fail = False
    if model == 'aster-sim-judge-overcall@1' and defect == 'none':
        fail = True
    return {'verdict': 'fail' if fail else 'pass', 'confidence': .94,
            'explanation': f'Scripted {model}: Aster case {fixture["name"]}; observed class {defect}.', 'assertions': 1}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # No request bodies or credentials are logged.

    def reply(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/healthz':
            return self.reply(200, {'status': 'ok', 'mode': 'simulation'})
        if self.path.startswith('/health/'):
            model = unquote(self.path[len('/health/'):])
            if model not in {SUBJECT, *JUDGES}:
                return self.reply(404, {'detail': 'Unknown provider identifier'})
            down = model == 'aster-sim-judge-down@1'
            return self.reply(503 if down else 200, {'model': model, 'status': 'unavailable' if down else 'available',
                'note': 'Intentionally unavailable fixture' if down else 'Simulated provider answers'})
        self.reply(404, {'detail': 'Not found'})

    def do_POST(self):
        if self.path not in ('/subject', '/judge'):
            return self.reply(404, {'detail': 'Not found'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 2_000_000:
                raise ValueError('Request body must be between 1 and 2000000 bytes')
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('Request must be a JSON object')
            response = subject(payload) if self.path == '/subject' else judge(payload)
            self.reply(503 if response is None else 200, {'detail': 'Simulated Judge unavailable; no verdict returned'} if response is None else response)
        except (ValueError, KeyError, TypeError):
            self.reply(422, {'detail': 'Invalid Aster provider request; see docs/SIMULATOR.md'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=9100)
    args = parser.parse_args()
    print(f'Aster simulation listening on {args.host}:{args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
