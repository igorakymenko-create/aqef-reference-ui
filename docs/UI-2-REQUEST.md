# Prompt for Codex — Reference UI, slice UI-2 (with UI-1 corrections)

Read `AGENTS.md` and `docs/STAGE-1-BRIEF.md` first. This prompt amends the brief where it says so, and you should record those amendments in the brief file itself. Work on a new branch from `main`, after UI-1 has been merged.

---

## Part A — Brief amendments (record in `docs/STAGE-1-BRIEF.md`)

**A-1. §4, simulator.** Delete "modelled on the scripted providers in `aqef-cts-harness`". The simulator is derived only from the engine's documented provider protocol. This confirms your choice in UI-A01; close UI-A01 as resolved by the owner.

**A-2. §3, workspace on disk.** A static UI cannot read or write a folder on disk, so add one minimal **workspace service**:
- **It only lists, reads and writes YAML files** inside one mounted folder, `./workspace`, bound to loopback.
- **It holds no AQEF logic.** It does no validation beyond YAML syntax, makes no engine calls, and has no knowledge of Contracts.
- **It rejects any path outside the folder,** including traversal, absolute paths and symlinks that leave it.
- **It refuses to write a file that contains a key named like a secret value.** The names are `password`, `api_key`, `token` and `secret`, case-insensitive. The error says to use `secret_ref` instead.
- On first start, it seeds `./workspace` from `examples/aster/` if the folder is empty.

D-2 still holds: the browser talks to the engine API only for AQEF operations.

## Part B — Corrections to UI-1 (do these first)

**B-1. Simulated Judges must judge content, not read the answer.**

At present the subject puts an `aster_case` Artifact with `defect_class` into the Evidence, and the Judges read it. That is an answer key inside the Evidence. It defeats the purpose of the Judges, it will break Seeded Controls in UI-5 (a control's Evidence carries no such label), and it shows the answer to a learner.

Change it as follows:
- The **subject** still selects its behaviour from `variables.sim_case`. It emits **no** Artifact naming the case or the defect class. Keep `retrieved_context` and `tool_calls`.
- The **Judges** must not read `sim_case`, case names, or any field that names the expected verdict. They decide from the Conversation and Artifacts by **deterministic content rules**, one per property. For example:

  | Property | Rule |
  |---|---|
  | Grounding | Fail if a currency amount, a number of days, or an eligibility condition in the response does not appear in `retrieved_context`. |
  | Retrieval | Fail if `retrieved_context` has no source of the governing policy type. |
  | Claimed completion | Fail if the response claims an action completed and `tool_calls` has no call for it with a confirmed outcome. |
  | Tool argument | Fail if a tool-call argument identifier does not occur in the conversation or in an earlier tool result. |
  | Over-refusal | Fail if the response refuses while `retrieved_context` contains the requested public information. |
  | Correct refusal | Pass if the response refuses a request for another customer's private data. |

- **Which rule a Judge applies** is selected by the Judge `criteria` the engine sends. Use a documented, visible convention, such as a leading `[grounding]` tag in the criteria text. Document the convention in `docs/SIMULATOR.md`, and use it in the sample Contracts.
- **Judge variants:**
  - `reliable`: applies the rules as written.
  - `blind`: never applies the grounding rule's amount check, so it misses unsupported amounts.
  - `overcall`: has one deterministic false-alarm rule. It fails any response that states a currency amount, even a supported one. It does **not** fail every clean case.
  - `down`: unchanged.
- **Explanations** state the rule and the text that triggered it. They never name a case.
- **Add checks** that:
  - the Evidence contains no case or class label;
  - a hand-written Evidence item, not produced by the subject, is judged by the same rules.

**B-2. Label every Result.**

The Test Explorer shows "actionable · pass" three times for one Scenario, with nothing to say which check each one is. Each Result entry must show:
- the clause `id`, or "unnamed clause" with its position;
- the Oracle kind (Validator, Judge or Human Reviewer) and identifier;
- the disposition and verdict;
- Confidence, or the engine's explicit "not applicable";
- a link that opens that Result's Evidence.

Group the entries by clause. Show resolution, a Result resolving an earlier one, exactly as the engine records it, without deriving it. Do not add a combined or per-Scenario verdict.

## Part C — Slice UI-2: Workspace and Visual Test Designer (S-2, S-3)

**C-1. Workspace screen (S-2).**
- File tree of `./workspace` and a YAML editor with syntax highlighting.
- Schema checks as you type, derived from AQEF 1.0-CR1 Appendices A and B at the tag. Use the specification text only, not `conformance-tests/`. Keep the derived schema in the repository with a note of its source sections.
- The engine remains the authority. A configuration the engine rejects is shown with the engine's message, verbatim.
- **Apply:**
  1. Compute what the workspace would change in the engine: created, changed and unchanged resources, per resource.
  2. Show the diff.
  3. On confirmation, issue the engine's per-resource calls in dependency order.
  4. Report every call's outcome. A partial failure is shown as partial, never as success.
  5. Changes the engine governs through Approval Workflow, such as a Contract definition, are labelled as governed.
- **Export:** write the engine's current configuration to YAML in the workspace. Export, then Apply, produces no changes. This is the round-trip check.
- No secret values. `secret_ref` names are displayed as names.

**C-2. Visual Test Designer (S-3).**
- Forms for:
  - Scenario: prompt template and variables;
  - Dataset binding;
  - Contract clauses: Constraints with their Validators, Expectations with their Judges, `id`, `dimension`.
- The forms edit **the same YAML document** as the editor. The YAML diff of every form change is visible before it is saved.
- **Saving goes through the same Apply path as the YAML editor.** There is no separate save route. This is how "indistinguishable once saved" is met by construction.
- Fields the specification leaves to the author stay empty until the author fills them. No defaults are invented.
- Controls that touch an At Risk feature, such as Action Boundary, carry the "At Risk in 1.0-CR1" marker.

**C-3. Your own automated check for Volume XV's rule.**

Volume XV, Visual Test Designer: "a Scenario authored visually and one authored by hand in YAML MUST be indistinguishable once saved." Write your own end-to-end check from this sentence:
1. Author a Scenario in the forms.
2. Author the same Scenario under another name in the YAML editor.
3. Save both.
4. Retrieve both through the engine API.
5. Compare every author-supplied field and the effective Contract each resolves to. Exclude identifiers, timestamps and other values the engine sets itself.

This is an independent check, not a CTS test, and it makes no CTS claim.

## Done when

1. B-1 and B-2 are in place, with their checks.
2. `docker compose up` starts the engine, `aster-sim`, the workspace service and the UI. The sample workspace is seeded.
3. A Scenario created in the forms and one created in YAML pass the C-3 check.
4. Export, then Apply, reports no changes.
5. An engine rejection during Apply is shown verbatim and marked as a partial or failed apply.
6. All earlier checks still pass. The README, `docs/AMBIGUITIES.md` and `docs/IMPLEMENTATION_NOTES.md` are updated. Every new ambiguity or engine gap is recorded, not decided silently.