"""Author the four UI-4 additions; preserves all existing sample definitions."""
from pathlib import Path
import copy
import yaml

path = Path(__file__).resolve().parents[1] / 'examples/aster/project.yaml'
data = yaml.safe_load(path.read_text(encoding='utf-8'))
scenarios = data['project']['suites'][0]['scenarios']
grounding = copy.deepcopy(scenarios[0]['contract']['expectations'][0])
def scenario(name, case, expectation, question):
    return {'name':name, 'prompt':{'template':'{{question}}'}, 'variables':{'sim_case':case,'question':question}, 'contract':{'expectations':[expectation]}}
flaky = copy.deepcopy(grounding)
flaky['judge']['model'] = 'aster-sim-judge-flaky@1'
panel = copy.deepcopy(grounding)
del panel['judge']
panel['multi_judge'] = {'purpose':'independence','judges':[{'model':f'aster-sim-judge-{variant}@1','confidence_source':'self_rating'} for variant in ['reliable','blind','overcall']], 'consensus':{'method':'voting','threshold':'unanimous','on_disagreement':'human_review'}}
new = [
    scenario('approximate-amount','approximate-amount',copy.deepcopy(grounding),'How much is my refund?'),
    scenario('recoverable-outage','grounded',flaky,'What is my $49 refund?'),
    scenario('human-signoff','grounded',{'id':'human-signoff','criteria':'Review the refund answer and recorded policy.', 'human_reviewer':{'role':'aster-reviewer','captures_confidence':False},'review_timeout':'24h','on_timeout':'block'},'What is my $49 refund?'),
    scenario('panel-disagreement','grounded',panel,'What is my $49 refund?'),
]
existing = {s['name'] for s in scenarios}
scenarios.extend(s for s in new if s['name'] not in existing)
path.write_text(yaml.safe_dump(data,sort_keys=False,width=95),encoding='utf-8')
