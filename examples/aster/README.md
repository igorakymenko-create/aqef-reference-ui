# Aster: scope checks to the property being exercised

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

A refund amount does not earn a correct-refusal pass. A latency Scenario does not
earn a semantic pass for a property it was not designed to exercise. The engine
composes the general Constraints with each Scenario's own Expectations; the UI never
calculates a combined Scenario verdict. Test Explorer counts are labelled **counts,
not a verdict**, retain each disposition and verdict, and expand to the full Results.

On an existing installation, seed files and historical records are not overwritten.
Review the sample update in Workspace's Apply preview, confirm it, then re-run the
Suite. The independent API/browser checks inspect the new Execution Results and
assert that each Judge clause belongs to this table. Old Results remain historical.
