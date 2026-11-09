# Conformance Statement: aqef-reference-ui

```yaml
aqef_conformance:
  specification_version: "1.0-CR1"
  implementation: "aqef-reference-ui 60c354e"
  capabilities:
    - reference_ui
  depends_on:
    engine: "aqef-reference-engine slice-12, vendored in vendor/engine"
    engine_statement: "https://github.com/igorakymenko-create/aqef-reference-engine (docs/CONFORMANCE-STATEMENT.md)"
```

**What this claims.** This repository is a presentation and authoring layer over an AQEF
engine's REST API (Volume XV). It claims one capability, `reference_ui`. Every other
capability (the core, `human_review`, `multi_judge`, `seeded_controls`) is the engine's
claim, made in the engine's own statement and tested against the engine. It is not
claimed again here.

A Conformance Statement says what is to be checked. It does not show that the checks
pass (AQEF §10). The results below are recorded separately, and each one links to its
evidence.

## Results: CTS 1.0-CR1, Section 26

| Test | Method | Outcome | Decided by | Record |
|---|---|---|---|---|
| CT-RUI-001: a visually authored Scenario equals a YAML one | Automated | PASS | aqef-cts-harness 0.6.0, run `r261108160634` | [harness run](https://github.com/igorakymenko-create/aqef-cts-harness/tree/main/runs/r261108160634) |
| CT-RUI-002: no Confidence and no model in a Validator | Inspection | PASS | `reviewer://google/gemini-3.8-flash` | `reviews/CT-RUI-002.gemini-2.review.json` |
| CT-RUI-003: Multi Judge purpose is chosen explicitly | Inspection | PASS | `reviewer://google/gemini-3.8-flash` | `reviews/CT-RUI-003.gemini-2.review.json` |
| CT-RUI-004: a Report and a Dashboard cannot be mistaken for each other | Inspection | PASS (second review) | `person://alona-marchenko` | `reviews/CT-RUI-004.human-2.review.json` |

**CT-RUI-004 took two reviews. Both records are kept.**
1. The first review is `NOT_RUN` (`reviews/CT-RUI-004.human-1.review.json`). The reviewer
   could not confirm that the Report showed the moment it was frozen. She also found the
   line "Current state may differ" misleading.
2. The Report's wording was changed in commit `60c354e`.
3. The second review, on new evidence, is `PASS`.

All four records are signed by the owner's attestation (`reviews/ATTESTATION.md`), as
Harness Contract §13 provides.

**Disclosed deviations and limits** (details in `reviews/ATTESTATION.md`):
- **CT-RUI-004 fixture.** The test names the CTS fixture F-SIGNALS. This repository may
  not use CTS material, so the Report and Dashboard come from the UI's own sample Project,
  with the same Suite and Environment for both. The reviewer was asked whether this
  changes her answers, and said it does not.
- **CT-RUI-004 reviewer.** She is a family member of the owner. She had no part in the
  UI's development, and the relationship is stated in her record.
- **One reviewer per test.** No test was disputed, so no second blind reviewer was
  needed (CTS 1.8).
