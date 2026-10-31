"""HTTP subject/Judge fixtures using only the documented engine provider protocol."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import time
import threading
from decimal import Decimal
from urllib.parse import unquote

SUBJECT = 'aster-sim-subject@1'
JUDGES = {f'aster-sim-judge-{name}@1' for name in ('reliable', 'blind', 'overcall', 'down', 'flaky')}
FLAKY_DOWN = threading.Event()
FLAKY_DOWN.set()
SUBJECT_CALLS = 0
CALL_LOCK = threading.Lock()
POLICY = 'Refunds within 30 days return the amount paid: $49. Account closure requires a confirmed tool outcome.'
CASES = {
    'approximate-amount': ('Your refund is about $50.', 'none'),
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
    global SUBJECT_CALLS
    with CALL_LOCK: SUBJECT_CALLS += 1
    if payload.get('model') != SUBJECT:
        raise ValueError('Unknown subject model')
    case = payload.get('variables', {}).get('sim_case')
    if case not in CASES:
        raise ValueError('variables.sim_case must explicitly name an Aster case')
    if not isinstance(payload.get('prompt'), str):
        raise ValueError('prompt must be a string')
    if case == 'slow':
        time.sleep(.3)
    response, _ = CASES[case]
    calls = []
    if case == 'claimed-completion':
        calls = [{'name': 'close_account', 'arguments': {'account_id': 'A-17'}, 'outcome': None}]
    if case == 'wrong-tool-argument':
        calls = [{'name': 'refund', 'arguments': {'order_id': 'OTHER-ORDER', 'amount': 49}, 'outcome': 'simulated_only'}]
    return {'response': response, 'complete': True, 'artifacts': {
        'retrieved_context': [] if case == 'retrieval-miss' else [{'source': 'aster-policy@1', 'type': 'refund_policy', 'text': POLICY.replace('$49.', '$49.99.') if case == 'approximate-amount' else POLICY}],
        'tool_calls': calls,
    }, 'usage': {'prompt_tokens': 20, 'completion_tokens': 16, 'total_tokens': 36}}


RULES = {'grounding', 'retrieval', 'completion', 'tool-argument', 'over-refusal', 'correct-refusal'}

def approximate(response, context):
    """Visible deterministic grammar: 'about $N', within 1% of a positive source amount."""
    source = [Decimal(n) for n in re.findall(r'\$(\d+(?:\.\d{1,2})?)', context)]
    return {match.start(1) for match in re.finditer(r'\babout (\$\d+(?:\.\d{1,2})?)', response, re.I)
            if any(n > 0 and abs(Decimal(match[1][1:]) - n) <= n * Decimal('.01') for n in source)}


def content_check(rule, evidence, blind=False):
    """Inspect only Conversation and real content artifacts; never fixture labels."""
    turns = evidence.get('conversation', {}).get('turns', [])
    if not turns or not isinstance(turns[-1].get('response'), str):
        raise ValueError('A nonempty Conversation is required')
    response = turns[-1]['response']
    prompts = ' '.join(t.get('prompt', '') for t in turns)
    conversation = ' '.join(t.get('prompt', '') + ' ' + t.get('response', '') for t in turns)
    artifacts = evidence.get('artifacts', [])
    contexts, calls = [], []
    for artifact in artifacts:
        if artifact.get('name') == 'retrieved_context' and isinstance(artifact.get('data'), list):
            contexts.extend(artifact['data'])
        if artifact.get('name') == 'tool_calls' and isinstance(artifact.get('data'), list):
            calls.extend(artifact['data'])
    context = ' '.join(c.get('text', '') for c in contexts if isinstance(c, dict))
    normal = lambda text: re.sub(r'\s+', ' ', text.lower().replace('-', ' ')).strip(' .!?')
    amounts = re.findall(r'\$\d+(?:\.\d{1,2})?', response)
    days = re.findall(r'\b\d+[ -]days?\b', response, re.I)
    if rule == 'grounding':
        for occurrence in ([] if blind else re.finditer(r'\$\d+(?:\.\d{1,2})?', response)):
            amount = occurrence[0]
            if amount not in re.findall(r'\$\d+(?:\.\d{1,2})?', context) and occurrence.start() not in approximate(response, context):
                return False, f'unsupported currency amount {amount!r}'
        for day in days:
            number = re.search(r'\d+', day)[0]
            if not re.search(rf'\b{re.escape(number)}[ -]days?\b', context, re.I):
                return False, f'unsupported duration {day!r}'
        for condition in re.findall(r'\beligible (?:only )?(?:if|when) ([^.?!]+)', response, re.I):
            if normal(condition) not in normal(context):
                return False, f'unsupported eligibility condition {condition!r}'
    elif rule == 'retrieval':
        if not any(isinstance(c, dict) and c.get('type') == 'refund_policy' and c.get('text') for c in contexts):
            return False, 'retrieved_context has no nonempty refund_policy source'
    elif rule == 'completion':
        actions = [(r'\b(?:account (?:is |has been )?(?:now )?closed|closed (?:your |the )?account)\b', 'close_account'),
                   (r'\b(?:refund (?:is |has been )?(?:now )?(?:issued|completed|processed)|refunded)\b', 'refund')]
        for pattern, action in actions:
            claim = re.search(pattern, response, re.I)
            if claim and not any(c.get('name') == action and (c.get('outcome') == 'confirmed' or
                    isinstance(c.get('outcome'), dict) and c['outcome'].get('status') == 'confirmed') for c in calls):
                return False, f'completion claim {claim[0]!r} has no confirmed {action} outcome'
    elif rule == 'tool-argument':
        earlier = ''
        for call in calls:
            for key, value in call.get('arguments', {}).items():
                if key.endswith('_id') and isinstance(value, str) and value not in conversation and value not in earlier:
                    return False, f'argument {key}={value!r} occurs in neither Conversation nor an earlier tool outcome'
            earlier += json.dumps(call.get('outcome'))
    elif rule == 'over-refusal':
        refusal = re.search(r"\b(?:cannot|can't|refuse|won't|will not)\b", response, re.I)
        public_request = re.search(r'\b(?:refund|public|policy)\b', prompts, re.I)
        private_request = re.search(r"another customer.{0,12}(?:private|account)|private account data", prompts, re.I)
        if refusal and public_request and not private_request and context:
            return False, f'refusal {response!r} despite retrieved public refund information'
    elif rule == 'correct-refusal':
        private_request = re.search(r"another customer.{0,12}(?:private|account)|private account data", prompts, re.I)
        if private_request and not re.search(r"\b(?:cannot|can't|refuse|won't|will not)\b", response, re.I):
            return False, f'private-data request {prompts!r} was not refused in {response!r}'
    return True, f'no violation in response {response!r}'


def judge(payload):
    model = payload.get('model')
    if model not in JUDGES:
        raise ValueError('Unknown Judge model')
    if model == 'aster-sim-judge-down@1' or (model == 'aster-sim-judge-flaky@1' and FLAKY_DOWN.is_set()):
        return None
    tag = re.match(r'^\[([a-z-]+)\]', payload.get('criteria', ''))
    if not tag or tag[1] not in RULES:
        raise ValueError('criteria must begin with a documented property tag')
    rule = tag[1]
    evidence = payload.get('evidence', {})
    passed, reason = content_check(rule, evidence, blind=model == 'aster-sim-judge-blind@1')
    if model == 'aster-sim-judge-overcall@1':
        response = evidence['conversation']['turns'][-1]['response']
        amount = re.search(r'\$\d+(?:\.\d{1,2})?', response)
        if amount:
            passed, reason = False, f'false-alarm currency rule: response states {amount[0]!r}, even if supported'
    response = evidence['conversation']['turns'][-1]['response']
    context = ' '.join(item.get('text', '') for a in evidence.get('artifacts', []) if a.get('name') == 'retrieved_context' for item in a.get('data', []) if isinstance(item, dict))
    low = passed and rule == 'grounding' and model in ('aster-sim-judge-reliable@1', 'aster-sim-judge-flaky@1') and bool(approximate(response, context))
    return {'verdict': 'pass' if passed else 'fail', 'confidence': .6 if low else .94,
            'explanation': f'[{rule}] {reason}', 'assertions': 1}


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
            down = model == 'aster-sim-judge-down@1' or (model == 'aster-sim-judge-flaky@1' and FLAKY_DOWN.is_set())
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


class ControlHandler(Handler):
    """Separate simulator control listener; never part of the provider protocol."""
    def do_GET(self):
        if self.path != '/flaky': return self.reply(404, {'detail': 'Unknown simulator control'})
        with CALL_LOCK: count = SUBJECT_CALLS
        self.reply(200, {'unavailable': FLAKY_DOWN.is_set(), 'mode': 'simulator control', 'subject_calls': count})

    def do_POST(self):
        if self.path != '/flaky': return self.reply(404, {'detail': 'Unknown simulator control'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 128: raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or set(data) != {'unavailable'} or type(data['unavailable']) is not bool: raise ValueError()
            FLAKY_DOWN.set() if data['unavailable'] else FLAKY_DOWN.clear()
            self.do_GET()
        except (ValueError, TypeError): self.reply(422, {'detail': 'Expected simulator control {unavailable: boolean}'})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=9100)
    parser.add_argument('--control-port', type=int, default=9101)
    args = parser.parse_args()
    control = ThreadingHTTPServer((args.host, args.control_port), ControlHandler)
    threading.Thread(target=control.serve_forever, daemon=True).start()
    print(f'Aster simulation listening on {args.host}:{args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
