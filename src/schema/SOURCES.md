# Authoring schema provenance

`authoring.json` is an authoring subset transcribed by
`scripts/derive_authoring_schema.py` from the AQEF **1.0-CR1** specification prose:

* A.1 / B.2 Project and DefectClassConfig;
* A.2 / B.2 Environment, ToolConfig/ToolDef, ActionBoundary and BoundaryEntry;
* A.3–A.4 / B.2 Suite, Scenario, PromptDef, SeededControlConfig and FixedEvidence;
* A.5–A.7 / B.2 Contract, Constraint, Expectation, Policies, JudgeConfig,
  HumanReviewerConfig, MultiJudgeConfig and ConsensusConfig;
* A.8–A.10 / B.2 Static Dataset, Row, ExecutionConfig, RetryConfig, QualityGate and MinBasis.

Normative sources at the specification tag:
[Appendix A](https://github.com/igorakymenko-create/AQEF/blob/1.0-CR1/appendices/appendix-a-yaml-specification.md),
[Appendix B](https://github.com/igorakymenko-create/AQEF/blob/1.0-CR1/appendices/appendix-b-json-schema.md).
Volume XV supplies the independent authoring-equivalence requirement.

The original normative Markdown was read from the engine checkout's `spec/`.
No engine models, OpenAPI schemas, conformance tests, CTS harness or other external
test material were used to derive this schema. The engine OpenAPI is used separately
for the transport client, never as the normative authoring schema.

This is not a claim to publish the full B.1 conformance artifact: runtime record types
are outside this editor schema. The Dataset definition deliberately restricts sources
to Static and mechanisms to an empty list, matching the pinned engine's declared
capability boundary. Action Boundary structure is described, but the pinned engine
rejects acting tool configurations; applicable UI controls carry the At Risk marker.

AJV performs non-coercing property/conditional checks. It inserts no defaults.
Duplicate names, reference resolution, additive Contract composition, effective
clauses, governance and the other cross-resource B.3 rules remain engine-authoritative.
Warnings in the editor do not masquerade as successful engine validation. API errors
are displayed verbatim. Explicit null is never silently removed or replaced.

Workspace file wrappers are an implementation convention, not extra AQEF fields.
The browser unwraps them before sending Appendix C requests. See docs/WORKSPACE.md.
