# Oracle authoring (UI-3)

Select a YAML file containing the desired Contract, then open Validator Designer or
Judge Configuration. Select an attachment and an existing or new clause. Both forms
propose edits to that same file. Review & Apply compares the whole workspace with
the engine and shows governed writes, warnings and file diffs. Confirm Apply is the
only persistence route. An incomplete form lists missing choices and proposes no YAML.

Built-ins expose target, expected, id, dimension and veto with engine parameter hints.
Composition is `Contract.policies.validator_composition`. Tool-call and boundary are
visibly At Risk and outside the pinned engine's implemented acting-tool scope.

Custom registration adds a workspace document (the wrapper is a UI convention):

```yaml
project: aster-support
validator:
  name: response-budget
  version: "1"
  rule:
    operation: range
    minimum: 0
    maximum: 2000
```

Apply calls `POST /projects/aster-support/validators` for a new immutable name/version.
The closed rule DSL supports equals, range, schema, structural and forbidden-content.
Binding uses `validator: response-budget@1`, a target, explicit dimension, and
`expected: null` or `{}`. Changing a registered rule requires a new version.
The custom form requires an explicit answer to its non-determinism question. Yes
or a mapped model identifier refuses registration and offers a Judge draft handoff.
No attestation or model metadata is sent as an undocumented engine field.

Single Judges expose model, criteria, confidence_source and threshold. Simulator
property tags are visible hints, never automatically inserted. The pinned protocol
has no separate Judge prompt field: criteria is its instruction. Model/criteria
changes warn in the form and preview; confidence_source also changes exact identity.

Multi Judge starts with no purpose. Independence requires distinct configurations;
stability uses one configuration and an explicit sample count. Methods are `voting`
and `confidence_weighted_mean`. Voting accepts majority, unanimous or a fraction
greater than 0.5 and at most 1.0. Omitted defaults are described, never inserted:
majority, human_review and full-panel quorum.

For each Judge the form paginates `/admissions`, matches the exact documented
`http-judge-v1` identity (model, criteria, confidence_source, type, version), and
displays the last matching record's `admitted` flag: admitted, not admitted or no
record. Threshold is not part of identity. No Admission metrics are computed or
written. Read failures remain errors. This identity is pinned to the engine version.

Exact subject model identity in any Project Environment is a hard refusal. Family
resemblance is a documented identifier heuristic and an advisory warning, without
claiming knowledge of actual shared weights. See AMBIGUITIES.md UI-A15.
