"""Authoring subset, manually transcribed from AQEF 1.0-CR1 A.1-A.10/B.2.

No engine schema, models or external tests are used. Cross-resource B.3 rules
remain engine-authoritative. No default is injected into the author's document.
"""
import json
from pathlib import Path

D = {}
S = {'type': 'string', 'minLength': 1}
B = {'type': 'boolean'}
I = {'type': 'integer', 'minimum': 1}
F = {'type': 'number', 'minimum': 0, 'maximum': 1}
O = {'type': 'object'}
def ref(name): return {'$ref': '#/definitions/' + name}
def arr(item, minimum=0): return {'type': 'array', 'items': item, 'minItems': minimum}
def enum(*values): return {'type': 'string', 'enum': list(values)}
def obj(name, properties, required=(), **extras):
    D[name] = {'type': 'object', 'properties': properties, 'required': list(required), 'additionalProperties': False, **extras}
    return ref(name)
def when(key, value): return {'properties': {key: {'const': value}}, 'required': [key]}
def prohibit(*keys): return {'not': {'anyOf': [{'required': [key]} for key in keys]}}
dimension = enum('functional', 'semantic', 'operational', 'safety')
contract = {'anyOf': [ref('Contract'), S]}
obj('Project', {'name': S, 'environments': arr(ref('Environment'), 1), 'suites': arr(ref('Suite')), 'execution': ref('ExecutionConfig'), 'datasets': arr(ref('Dataset')), 'defect_classes': arr(ref('DefectClassConfig')), 'contracts': arr(contract), 'quality_gates': arr(ref('QualityGate'))}, ['name', 'environments'])
obj('Environment', {'name': S, 'model_version': S, 'prompt_version': S, 'tool_configuration': {'anyOf': [ref('ToolConfig'), {'type': 'null'}]}, 'action_boundary': ref('ActionBoundary'), 'infra_target': S}, ['name', 'model_version', 'prompt_version', 'tool_configuration', 'infra_target'], allOf=[{'if': {'properties': {'tool_configuration': {'type': 'object'}}, 'required': ['tool_configuration']}, 'then': {'required': ['action_boundary']}}])
obj('ToolConfig', {'tools': arr(ref('ToolDef'))}, ['tools'])
obj('ToolDef', {'name': S, 'parameters': O}, ['name', 'parameters'])
obj('ActionBoundary', {'enforced': B, 'entries': arr(ref('BoundaryEntry'), 1)}, ['enforced', 'entries'])
obj('BoundaryEntry', {'target': S, 'kind': enum('stub','sandbox','real'), 'tripwire': B}, ['target','kind'], allOf=[{'if': when('tripwire',True), 'then': when('kind','stub')}])
obj('Suite', {'name': S, 'scenarios': arr(ref('Scenario'),1), 'contracts': arr(contract), 'quality_gates': arr(ref('QualityGate')), 'execution': ref('ExecutionConfig')}, ['name','scenarios'])
obj('PromptDef', {'template': S}, ['template'])
obj('Scenario', {'name': S, 'contract': contract, 'prompt': ref('PromptDef'), 'dataset': {'type':'string','pattern':'^.+@.+$'}, 'variables': O, 'seeded_control': ref('SeededControlConfig'), 'evidence': ref('FixedEvidence')}, ['name'], allOf=[{'not': {'required':['dataset','variables']}}, {'if': {'properties': {'seeded_control': when('confirmed_by','construction')}, 'required':['seeded_control']}, 'then': {'required':['evidence'], **prohibit('prompt','dataset','variables')}, 'else': {'required':['prompt'], **prohibit('evidence')}}])
obj('FixedEvidence', {'conversation': ref('Conversation'), 'artifacts': O, 'source_execution': S}, ['conversation'])
obj('Conversation', {'turns':arr(ref('Turn'),1)}, ['turns'])
obj('Turn', {'prompt': {'type':'string'}, 'response': {'type':'string'}}, ['prompt','response'])
obj('Contract', {'name': S, 'constraints':arr(ref('Constraint')), 'expectations':arr(ref('Expectation')), 'policies':ref('Policies'), 'extends':arr(S)}, anyOf=[{'required':['constraints'], 'properties':{'constraints':{'minItems':1}}},{'required':['expectations'], 'properties':{'expectations':{'minItems':1}}}])
clause = {'id':S, 'dimension':dimension, 'defect_classes':arr(S)}
obj('Constraint', {**clause,'validator':S,'target':S,'expected':{},'veto':B}, ['validator','target','expected'])
obj('Expectation', {**clause,'criteria':S,'judge':ref('JudgeConfig'),'multi_judge':ref('MultiJudgeConfig'),'human_reviewer':ref('HumanReviewerConfig'),'confidence_threshold':F,'review_timeout':S,'on_timeout':enum('block','escalate'),'escalate_to':S}, ['criteria'], oneOf=[{'required':[key], **prohibit(*[other for other in ['judge','multi_judge','human_reviewer'] if other!=key])} for key in ['judge','multi_judge','human_reviewer']], allOf=[{'if':{'anyOf':[{'required':['judge']},{'required':['multi_judge']}]},'then':{'required':['confidence_threshold']}},{'if':when('on_timeout','escalate'),'then':{'required':['escalate_to']},'else':prohibit('escalate_to')}])
obj('Policies', {'validator_composition':enum('AND','OR','hard-veto'),'weight':{'type':'number','exclusiveMinimum':0}})
obj('JudgeConfig', {'model':S,'confidence_source':enum('self_rating','token_probability','agreement')}, ['model','confidence_source'])
obj('HumanReviewerConfig', {'role':S,'captures_confidence':B}, ['role'])
obj('MultiJudgeConfig', {'purpose':enum('independence','stability'),'judges':arr(ref('JudgeConfig'),2),'judge':ref('JudgeConfig'),'samples':{'type':'integer','minimum':2},'consensus':ref('ConsensusConfig')}, ['purpose','consensus'], allOf=[{'if':when('purpose','independence'),'then':{'required':['judges'],**prohibit('judge','samples')},'else':{'required':['judge','samples'],**prohibit('judges')}}])
obj('ConsensusConfig', {'method':S,'threshold':{'anyOf':[enum('majority','unanimous'),{'type':'number','exclusiveMinimum':.5,'maximum':1}]},'min_agreement':F,'on_disagreement':enum('human_review','fail'),'min_qualified':I}, ['method'], allOf=[{'if':{'not':when('method','voting')},'then':prohibit('threshold')}])
obj('Dataset', {'name':S,'version':S,'source':enum('static'),'rows':arr(ref('Row')),'base_dataset':{'type':'string','pattern':'^.+@.+$'},'mechanisms':{'type':'array','maxItems':0}}, ['name','version','source','rows'])
obj('Row', {'id':S,'variables':O}, ['id','variables'])
obj('ExecutionConfig', {'timeout':S,'retry':ref('RetryConfig'),'scheduling':S,'parallelization':I,'on_seeded_control_miss':enum('skip_class','halt_run')})
obj('RetryConfig', {'max_attempts':I,'on':{'const':'infrastructure_failure'}}, ['max_attempts','on'])
obj('QualityGate', {'name':S,'aggregate':S,'threshold':{'anyOf':[{'type':'number'},O]},'compare_against':S,'min_basis':ref('MinBasis'),'on_failure':enum('block_release','warn'),'override_requires':S,'require_admitted_judges':B}, ['name','aggregate','threshold','on_failure'])
obj('MinBasis', {'results':I,'scenarios':I}, anyOf=[{'required':['results']},{'required':['scenarios']}])
prior = {'difficulty_prior':{'anyOf':[F,{'const':'not_established'}]},'prior_basis':I,'prior_source':enum('reference_oracles','human_reviewer'),'reference_oracles':arr(ref('JudgeConfig'))}
provenance = {'if':{'properties':{'difficulty_prior':{'type':'number'}},'required':['difficulty_prior']},'then':{'required':['prior_basis','prior_source']}}
obj('DefectClassConfig', {'name':S,**prior}, ['name'], allOf=[provenance])
obj('SeededControlConfig', {'kind':enum('defect','clean'),'defect_class':S,**prior,'planted_defect':{},'confirmed_by':enum('validator','human_reviewer','construction'),'confirmation':ref('Constraint'),'generator':S}, ['defect_class','confirmed_by'], allOf=[provenance,{'if':when('kind','clean'),'then':prohibit('planted_defect','difficulty_prior','prior_basis','prior_source','reference_oracles'),'else':{'required':['planted_defect']}},{'if':when('confirmed_by','validator'),'then':{'required':['confirmation']},'else':prohibit('confirmation')}])
customRules = [{'type':'object','properties':{'operation':{'const':operation},'expected':{}},'required':['operation','expected'],'additionalProperties':False} for operation in ['equals','schema','forbidden-content','structural']]
customRules.append({'type':'object','properties':{'operation':{'const':'range'},'minimum':{'type':'number'},'maximum':{'type':'number'}},'required':['operation','minimum','maximum'],'additionalProperties':False})
obj('CustomValidator', {'name':{'type':'string','minLength':1,'pattern':'^[A-Za-z0-9_.-]+$'},'version':{'type':'string','minLength':1,'pattern':'^[A-Za-z0-9_.-]+$'},'rule':{'oneOf':customRules}}, ['name','version','rule'])
D['CustomValidator']['description']='Volume V / XV deterministic Validator; declarative registry request from pinned docs/API.md. No Confidence field.'
D['Constraint']['description']='Volume V / XV: a Validator MUST NOT carry a Confidence value or threshold.'
D['MultiJudgeConfig']['description']='Volume VI / XV / A.7: purpose MUST be explicitly independence or stability.'
schema = {'$schema':'http://json-schema.org/draft-07/schema#','$id':'https://aqef.local/schemas/authoring-1.0-CR1.json','title':'AQEF 1.0-CR1 authoring subset (pinned engine capabilities)','description':'Manually derived from A.1-A.10 and B.2; no runtime-schema or full B.1 conformance claim. B.3 is engine-authoritative. No defaults inserted.','definitions':D}
target=Path(__file__).resolve().parents[1]/'src/schema/authoring.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(schema,indent=2)+'\n',encoding='utf-8')
print('Wrote authoring schema from the cited specification prose; no engine models used.')
