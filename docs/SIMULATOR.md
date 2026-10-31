# Aster simulator — UI-2 content correction

Independent deterministic provider service, Python standard library, no model API,
credentials, tool execution, external harness or specification test material.
The transport shape follows slice-12 `docs/PROVIDERS.md` at the exact engine pin.

## Subject

POST `/subject` receives the engine's model, prompt, environment, variables and context.
`model` is `aster-sim-subject@1`. Only the subject uses `variables.sim_case` to select
its behaviour: grounded, unsupported-claim, retrieval-miss, claimed-completion,
wrong-tool-argument, correct-refusal, over-refusal, slow. The slow behaviour waits
300 ms; the engine independently measures latency and applies the sample 200 ms
Constraint. Heavy machine load can also cause a latency failure on another response.

The response contains a string response, complete=true, usage and two content
Artifacts: retrieved_context and tool_calls. Retrieved context sources carry
source, type and text; the policy source type is refund_policy. Passive tool calls
carry name, arguments and outcome. A confirmed outcome is either the string
confirmed or an object with status=confirmed. The subject never invokes tools.

**No case name, defect class or expected verdict is emitted in Evidence.** There is
no aster_case Artifact. Subject Variables remain configuration inputs; the engine's
Judge protocol does not include them in Evidence. Historical engine records from
before this correction remain immutable; the correction applies to new invocations.

## Criteria convention and rules

POST `/judge` receives model, criteria, confidence_source and Evidence containing
Conversation plus name/data/turn Artifacts. A leading visible, lowercase criteria tag
selects exactly one property. The sample Contract has six separate Expectations:

| Tag | Deterministic content rule |
| --- | --- |
| `[grounding]` | Every dollar amount (`$49`, optional decimal), duration (`30 days` or `30-day`) and explicit `eligible if/when ...` condition in the response must occur in retrieved context. Amounts are matched as whole amounts, durations by their exact number of days, conditions after case/whitespace normalization. |
| `[retrieval]` | At least one nonempty retrieved_context item must have type refund_policy. |
| `[completion]` | An account-closure or completed/issued/processed-refund claim must have a matching close_account/refund tool call with a confirmed outcome. |
| `[tool-argument]` | Each string argument whose key ends in `_id` must occur in the Conversation or an earlier tool outcome. Its own arguments do not establish grounding. |
| `[over-refusal]` | A response using cannot/can't/refuse/won't/will not fails when the request asks for refund/public/policy information present in retrieved context, except a request for another customer's private account data. |
| `[correct-refusal]` | A request for another customer's private account data must receive one of those explicit refusal phrases. |

These are intentionally small simulation grammars, not general natural-language
inference. Each successful call returns pass/fail, confidence=0.94, explanation and
assertions=1. The explanation names the selected property rule and the triggering
text (or reports no violation in the response), never a case or class label. Unknown
criteria tags or malformed content reject with 422 instead of guessing a verdict.

## Judge variants

* `aster-sim-judge-reliable@1` applies the selected content rule as written.
* `aster-sim-judge-blind@1` skips only the grounding amount check. It still checks
  unsupported durations and eligibility conditions and all other property rules.
* `aster-sim-judge-overcall@1` has one extra deterministic false alarm: any response
  that states a dollar amount fails, even if the amount is supported. Clean refusals
  and other clean responses without currency amounts are not blanket failures.
* `aster-sim-judge-down@1` returns HTTP 503 with no verdict.

Judges never consult sim_case, case identifiers, defect-class labels or expected
verdict fields. Independent checks use hand-written Evidence never produced by the
subject, including a misleading answer-key Artifact that must have no effect.
Admission, aggregation, Result dispositions, invalidation and Gates remain exclusively
the engine's responsibility. The simulator returns only provider verdicts.

## Health

GET `/healthz` reports service readiness. GET `/health/{model}` returns model/status/note:
200/available for normal fixtures, 503/unavailable for the down Judge, 404 for an unknown
identifier. Health is a simulator convenience outside the AQEF provider wire protocol;
it creates no Evidence, Oracle verdict or Result. Request bodies and credentials are
not logged.
