# Prompt for Codex — Reference UI, slice UI-3 (with UI-2 corrections)

Read `AGENTS.md` and `docs/STAGE-1-BRIEF.md` first. Work on a new branch from `main`. The same rules apply as before:
- derive every rule from the specification text at `1.0-CR1` and from the engine's documented API;
- never touch conformance-test material;
- record each ambiguity or engine gap in `docs/AMBIGUITIES.md`;
- leave the engine unchanged.

---

## Part A — Corrections from the UI-2 review (do these first)

**A-1. Scope the sample Contracts to what each Scenario tests.**

Today every property clause is attached to the Project-level Contract, so each one is applied to every Scenario. A refund question then receives a "correct-refusal" Judge Result of `pass` although no refusal was expected. Passes like that will enter aggregates and Gates in UI-6 and suggest assurance that does not exist. The sample also teaches the practice AQEF exists to prevent.

Restructure `examples/aster/`:
- **Project-level Contract:** only the general Constraints that apply to every response, such as "response is text" and latency.
- **Property clauses:** each one (grounding, retrieval, completion, tool argument, over-refusal, correct refusal) is attached at the Scenario or Suite level, only to the Scenarios that exercise that property. Use Contract Composition as Volume VII defines it.
- **Order of changes:**
  1. Update the sample.
  2. Show the change through the UI-2 Apply preview.
  3. Re-run the sample Suite.
  4. Confirm that no Scenario carries a Judge Result for a property it does not exercise.
- **Documentation:** record the reasoning in `examples/aster/README.md`. A clause applies to every Scenario in its scope, so scope it to where the property is meaningful.

**A-2. Compact rows in Test Explorer.**

With one Result per clause, the page has grown very long. Make two changes:
- Collapse each Scenario to one row by default. The row shows **counts** by disposition and verdict for the latest Execution, for example "7 actionable · pass, 1 actionable · fail, 1 not actionable", labelled **"counts, not a verdict"**.
- Expanding the row shows the full clause-by-clause list from UI-2, unchanged.

Do not add a combined verdict, a percentage, a colour for the Scenario as a whole, or any sorting that implies a ranking. Not-actionable outcomes keep their own visual state in the counts.

**A-3. Say why the Designer's YAML diff is empty.**

While a form is incomplete, the "YAML diff" panel is blank, which reads as "nothing changed". Show this instead:

> "Form incomplete — choose: …. No YAML is proposed yet."

List the missing fields. The diff appears as soon as the form can be expressed as YAML.

## Part B — Slice UI-3: Validator Designer (S-5) and Judge Configuration (S-6)

Both screens are forms over the same YAML document and save through the same Review & Apply path as UI-2. Neither screen has a save route of its own.

### B-1. Validator Designer (S-5)

Volume XV: a Validator configured here *"MUST be deterministic and MUST NOT carry a Confidence value"*. A check that calls a model to decide pass/fail *"is configuring a Judge"*, and the Validator Designer *"MUST surface that distinction rather than silently accept the configuration under the wrong label."*

**Built-in Validators.** List the Validators the engine provides, with their parameters as Appendix A §A.5 and the engine's documentation define them: target, expected, `veto`, `id`, `dimension`. Also cover `validator_composition` within a clause (Volumes V and VII).

**No Confidence, anywhere.**
- The forms have no Confidence field for a Validator.
- If the YAML editor gives a Constraint or a Validator a Confidence value or threshold, the schema check flags it with the rule. The Apply preview then refuses to proceed and names the rule.

**Custom Validators.** Registration is through the engine's `/validators` resource, as the engine documents it. The form asks explicitly: *"Does this check call a model, or any non-deterministic service, to decide pass or fail?"*
- **Yes:** the form refuses to save it as a Validator. It shows the reason, quoting Volume XV, and offers a link that opens Judge Configuration pre-filled with what the user entered.
- **No answer yet:** it cannot be saved.

**Other refusals.** A Validator configuration that names a model identifier mapped as a Judge or subject provider (see Connections) is refused in the same way. Record any further signal you choose to use in `docs/AMBIGUITIES.md`.

### B-2. Judge Configuration (S-6)

**Single Judge:**
- Judge model;
- criteria, with the simulator's property-tag convention visible as a hint, not hidden;
- `confidence_source`;
- Confidence threshold.

**Multi Judge.** Volume XV requires *"an explicit choice of which purpose it serves — independence or stability — rather than default silently to one"*.
- The form shows **no default purpose**, and a panel cannot be saved until a purpose is chosen.
- A YAML panel without a purpose is flagged with the rule, and Apply is refused.
- **Independence:** distinct Judge configurations.
- **Stability:** one configuration and a sample count.
- **Common fields:**
  - method (consensus or voting);
  - `threshold`: `majority`, `unanimous`, or a number greater than 0.5 and at most 1.0;
  - `on_disagreement`;
  - `min_qualified`.

  All are taken from Appendix A §A.7.
- Where the engine applies a documented default, for example `on_disagreement: human_review`, show that the default applies. Never write it into the YAML.

**Independent Oracles** (Volume I, Chapter 3):
- A Judge configuration whose model is the subject's `model_version` in any Environment of the Project is refused, with the reason quoted.
- Sharing the subject's model family is a SHOULD NOT. Show it as a warning, not a refusal.

**Admission status (read-only here; recording it is UI-5).**
- For every Judge configuration, show the most recent Admission record from `/admissions`: admitted, not admitted, or no record. Show nothing else.
- When the user changes a Judge's model, prompt or criteria, warn that this is a new Judge configuration and that its earlier Admission no longer applies (Volume VI). Show the warning in the form and in the Apply preview.

### B-3. Your own checks (independent, not CTS)

Write end-to-end checks from the specification sentences quoted above:
1. A Validator cannot be saved with a Confidence value, from the forms or from YAML.
2. A check declared as calling a model cannot be saved as a Validator. The user is redirected to Judge Configuration, with the reason shown.
3. A Multi Judge panel cannot be saved without an explicit purpose, from the forms or from YAML.
4. A Judge whose model equals the subject's model is refused.
5. Changing a Judge's criteria shows the new-configuration Admission warning.

## Done when

1. A-1 to A-3 are in place. After re-running the sample Suite, no Scenario carries a Result for a property it does not exercise.
2. S-5 and S-6 work end to end over the YAML document and through Review & Apply.
3. The checks in B-3 pass, together with every earlier check.
4. The README, `docs/AMBIGUITIES.md` and `docs/IMPLEMENTATION_NOTES.md` are updated.