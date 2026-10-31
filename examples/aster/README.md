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
