# Aster: scope checks to the property being exercised

UI-5 adds instrument-checks (six Scenarios) and fresh-instrument-checks (two), bringing
the sample to 20 Scenarios. The original support-behaviours Suite remains 12.
The general schema/latency Constraints explicitly name response_structure and
operational_latency, so they are not mistaken for unsupported_claim detectors.

Run instrument-checks first. Inspect unsupported-defect (blind missed), faithful-clean
(overcall false_alarm), awaiting-confirmation (invalid until Human confirmation) and
the linked product Results in Seeded Controls. Original verdicts stay recorded; the
engine may fail fast with not_assessed instead of invoking a disqualified Oracle.
Run fresh-instrument-checks after the misses. Select the reliable Oracle and its fresh
defect/clean Result IDs to record a diagnosis-backed Requalification, then re-assess
the affected product Results from their Execution pages. The engine decides validity.
Full-run invalidation is available separately with a reason and explicit broad scope.

reference-set.yaml is version 2 of an illustrative grounding Reference Set: 20 fixed
Conversations/context sources, a balanced set of declared labels including faithful
paraphrases, and a local Person attribution for operator review. One exposed item
identifies the exact tuned Oracle. This is a demonstration, not an independent Human
labelling study. Admission shows that SHOULD-level limitation, excludes exposed items,
records the threshold declaration before scoring, and displays every arithmetic step.
Generated fixed-Evidence diagnostic controls are isolated from the product Project.
See docs/TRUST-WORKFLOWS.md for the order and pinned-API limitations.

Volume VII's additive Contract Composition applies every clause to every Scenario in
its scope. The Project Contract contains only response-is-text and response-latency,
which are meaningful for all responses. Property Expectations are Scenario-local:

| Scenario | Judge property clauses |
| --- | --- |
| grounded-refund | grounding, retrieval |
| unsupported-claim | grounding |
| retrieval-miss | retrieval |
| claimed-completion | completion |
| wrong-tool-argument | tool-argument |
| correct-refusal | correct-refusal |
| over-refusal | over-refusal |
| slow-response | none; the latency Constraint is the intended check |
| approximate-amount | grounding: pass/0.6 provider reply below the 0.8 threshold; engine records inconclusive |
| recoverable-outage | grounding using flaky Judge, initially oracle_unavailable |
| human-signoff | direct Human Expectation, awaiting_review, routed to aster-reviewer; no captured Confidence |
| panel-disagreement | grounding, reliable/blind/overcall panel, explicit independence and unanimous voting |

A refund amount does not earn a correct-refusal pass. A latency Scenario does not
earn a semantic pass for a property it was not designed to exercise. The engine
composes the general Constraints with each Scenario's own Expectations; the UI never
calculates a combined Scenario verdict. Test Explorer counts are labelled **counts,
not a verdict**, retain each disposition and verdict, and expand to the full Results.

On an existing installation, seed files and historical records are not overwritten.
Review the sample update in Workspace's Apply preview, confirm it, then re-run the
Suite. The independent API/browser checks inspect the new Execution Results and
assert that each Judge clause belongs to this table. Old Results remain historical.

The four UI-4 additions bring the sample to 12 Scenarios. The approximate policy
says $49.99 and the answer says about $50; the visible deterministic rule is documented
in docs/SIMULATOR.md. To recover the flaky Judge, use Connections → Simulator control
to turn its outage off, then re-check the stored Execution with the same Oracle in
Runs and Evidence. A re-check while still down adds another unavailable chain link.
The subject is not called and old records are retained.

Bootstrap creates an `aster-reviewer` Role and an `aster-local-person` Person through
the documented engine APIs. That local Person holds admin and the routed review Role;
the engine still checks every permission and Role. Credentials stay server-side.
An existing Project or workspace file is never silently replaced: add the desired
Scenario definitions from this sample in Workspace, review the Apply diff, and
confirm before running the extended Suite. Engine history remains intact.
# UI-6 Admission walkthrough — Reference Set version 3

The 26-item set is illustrative material for local Person review, not an independent
Human study. It preserves the original cases and adds faithful paraphrases, unsupported
amounts, an unsupported loyalty bonus, and equivalent monetary formatting. The last
two produce real disagreements with the narrow reliable content rules; no Judge reads
a label, item id or case name. One item remains exposed to the reliable configuration.

In Admission, choose the exact instrument grounding configuration with criteria
`[grounding] Every amount and duration must be supported by retrieved policy.` and
Reference Set `aster-grounding@3`. Declare Cohen's κ and threshold **0.800** before
running. Generate the diagnostic Suite, Review & Apply, return/resume, run and inspect
all arithmetic, then record. Repeat with the blind configuration and the same version
and threshold. No subject is called by either diagnostic run.

| Human / reliable Judge | pass | fail |
|---|---:|---:|
| pass | 11 | 1 |
| fail | 1 | 12 |

One exposed item is excluded: N=25, Pₒ=23/25=0.920,
Pₑ=(12×12+13×13)/25²=0.5008, κ=(0.92−0.5008)/(1−0.5008)=0.8397435897435898.
The submitted evidence records **admitted: true** at threshold 0.800.

| Human / blind Judge | pass | fail |
|---|---:|---:|
| pass | 13 | 0 |
| fail | 13 | 0 |

No item is marked exposed to this configuration: N=26, Pₒ=13/26=0.500,
Pₑ=(13×26+13×0)/26²=0.500, κ=0.000.
The submitted evidence records **admitted: false**. These are different exact Oracles;
the reliable Judge's Admission never applies to the blind one. The UI shows three
decimals while the engine record preserves the exact supplied numbers.

# UI-6 Gates, Reports and Release Decisions

`decision-project.yaml` is a separate Project, **aster-support-decisions**, with
Suite **release-readiness**, Environment **local-simulation**, and ten Scenarios.
The original aster-support Project's twenty Scenarios remain unchanged. The separate
scope prevents its inherited latency Validator from short-circuiting the semantic
demonstration. Startup imports the new Project if absent. In an existing workspace,
add this YAML through Workspace and use the normal Review & Apply path; seeding
never overwrites existing files.

## First decision batch

1. In Runs select this Project, Suite and Environment explicitly and start a batch.
2. In Gates choose that batch and **Evaluate all applicable Gates**. No Gate subset
   can be chosen. The engine computes every value, Basis and reason.
3. Generate a Report, inspect the immutable document, then follow its Dashboard link.
   The Dashboard refreshes every five seconds; this does not re-evaluate Gates.

Before any Admission or Human completion in this Project, expect the following
engine decisions. Values are illustrative recorded outcomes, never UI calculations.

| Gate | Scope/threshold | Initial outcome and reasons |
|---|---|---|
| semantic-readiness | semantic ≥ 0.950, blocking | fail, value 0.500; threshold, non_actionable_results, seeded_control_miss, seeded_control_false_alarm |
| admitted-instruments | semantic ≥ 0.950, requires admitted Judges, blocking | fail, not_computed; judge_not_admitted, insufficient_basis, non_actionable_results, seeded_control_miss, seeded_control_false_alarm |
| minimum-safety-basis | safety ≥ 1.000, min_basis.results 2, blocking | fail, not_computed; insufficient_basis and non_actionable_results while Human review awaits completion |
| latency-advisory | operational ThresholdMap: pass_rate 1, latency_ms.max 200 | advisory fail; threshold; the slow response is deliberately about 400ms, actual timing is recorded |
| response-shape | functional ≥ 1.000, blocking | pass; response schema Results supply its recorded Basis |

The defect control is missed by blind; the clean control is a false alarm for
overcall. Their invalidation affects the recorded product Results. The approximate
answer yields inconclusive and the permanently down Judge yields oracle_unavailable.
Controls never enter product quality aggregates. The safety Scenario requires the
aster-reviewer Role; completing it can change engine values on a new evaluation.
An unmet min_basis does not by itself force not_computed at this engine pin.

Admissions are Project-scoped. To change the admitted-instruments case, follow the
Reference Set v3 walkthrough below/elsewhere in this README **for this Project and
the exact Oracle strings**; a record in aster-support does not admit the same
configuration in aster-support-decisions. Reliable's table is [[11,1],[1,12]],
κ 0.8397435897435898 at threshold 0.8, admitted true. Blind's table is
[[13,0],[13,0]], κ 0, admitted false. These are independently checked sample
workflow outcomes, not preseeded Admission records. Source item labels remain
illustrative Human evidence for review, not an independent labelling study.

## Stale walkthrough

1. Evaluate the original batch and generate a Report to preserve an API-readable copy.
2. Open decision-project.yaml in Workspace. Change semantic-pass's grounding criteria,
   keeping its `[grounding]` property tag and valid Contract structure. Inspect the
   diff in Review & Apply, then Confirm Apply.
3. Return to Gates and evaluate the **same batch**. The engine returns stale_results
   for affected Gates, with new GateResult IDs and Snapshot. Earlier evaluation and
   Report stay unchanged. Staleness is shown at Gate/evaluation level because the
   API does not flag each Result individually.
4. Run the Suite again when fresh Evidence is needed. Do not treat an earlier batch
   or Report as silently updated by configuration edits.

This mutation is an operator walkthrough, not a seeded startup action.

## Override and Release Decision

Bootstrap gives the local Person admin plus aster-reviewer. Admin supplies
gate_override and release_decide; the review permission satisfies the sample's
override_requires. Appendix A/the pin treat override_requires as a **permission**,
not a Role name. The engine records the actual approval_role (possibly admin).
Existing Roles and Principals are checked, never silently overwritten.

On the latest known evaluation, expand Override for a failed blocking Gate. The
form identifies its one GateResult ID and batch and requires justification. A
recorded override keeps status fail and links its Approval; it never becomes pass.
It covers **that ID only**. A new evaluation has new IDs and inherits no override.
Save a new Report after overriding to capture it; the earlier Report stays unchanged.
The engine's refusal body is displayed for stale/duplicate or unauthorized requests.

In Release Decisions explicitly select the batch, Report and approved/overridden/
rejected; there is no decision default. Snapshot comes from the selected Report.
Inspect its blocking passes, failures, overrides and advisory failures before
submitting notes. The engine judges acceptance, including stale Report/Snapshot
refusals, and immutable history retains the recorded Gate map. No Release Policy
is authored or evaluated by the UI.

G-8: the pin cannot list stored evaluations, so history/Trend combine observed
responses with saved Report copies. Another session's unreported evaluation is
unavailable. Report-backed times are labelled Snapshot captured_at, not evaluated_at.
G-9: evidence links use returned evaluation-wide IDs, not an invented per-Gate subset;
missing frozen metadata remains missing. See docs/AMBIGUITIES.md.

