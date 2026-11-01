# AQEF Reference UI — Stage 1 Brief

**Revision 1.1 · owner amendments for UI-2**
**For:** the implementing agent (Codex) and the project owner.
**Basis:**
- AQEF 1.0-CR1: Volume XV (Reference UI), Appendices A–C;
- CTS 1.0-CR1: Section 26, CT-RUI-001 to 004;
- `aqef-reference-engine` (pin the tag used at the start of work; the latest is `slice-12`);
- Simulator source: the pinned engine's documented provider protocol only (owner amendment A-1).

---

## 1. Purpose of Stage 1

Build a **local, single-user** working UI over the reference engine. The owner uses it to judge the concept: a hybrid in which **YAML is the source of truth** and the UI is a visual, navigable view of it, not a black box that produces a score.

Stage 1 succeeds when the owner can do the following without touching a terminal:
1. start everything with one command;
2. author a Project for the simulated Aster Support AI in YAML and in visual forms interchangeably;
3. run it;
4. read every verdict down to its Evidence;
5. record a Judge's Admission;
6. see Quality Gates decide, with their basis and reasons.

**Later stages, not in scope here:**
- **Stage 2:** a public demo (the same build in demo mode).
- **Stage 3:** external teams, with local use plus CI (a GitHub Actions example and a CLI).

## 2. Decisions already taken

| # | Decision |
|---|---|
| D-1 | Separate public repository, `aqef-reference-ui`, licensed Apache 2.0, the same as the engine and the harness. Not part of any commercial product. |
| D-2 | The UI is a **presentation and authoring layer over the engine's REST API** (Volume XV). It implements no AQEF logic of its own: no aggregation, no Gate evaluation, no admission decision. Where the engine decides, the UI shows the engine's answer. |
| D-3 | **Local only.** No shared server is planned. Collaboration goes through git (configuration, Reference Sets) and CI (runs). |
| D-4 | **Secrets never appear in AQEF configuration, in the UI, or in anything the engine stores.** Configuration refers to a secret by name (`secret_ref`). Values live in the environment of the machine or the CI runner. Stage 1 needs no secrets: it uses simulated providers only. |
| D-5 | **YAML is the source of truth.** A visual edit produces YAML, and the change is shown as a diff before it is applied. A Scenario authored visually and one written in YAML are indistinguishable once saved (CT-RUI-001). |
| D-6 | Every requirement of Volume XV is met. Stage 1 ends with the four CT-RUI tests passing (section 9). |

## 3. Architecture

```
docker compose up
 ├─ engine     aqef-reference-engine (pinned tag), unchanged, REST API on :8000
 ├─ aster-sim  simulated subject and Judges, engine provider protocol, on :9100
 ├─ workspace  YAML-only file service, ./workspace mount, loopback :9200
 └─ ui         static web app, served on :3000, calls the engine API
```

- **One command, one machine.**
  - Provider URLs go to the engine through `AQEF_PROVIDER_URLS`, as the engine documents.
  - The admin token comes from a local `.env` file that is never committed.
  - Ship a `.env.example`.
- **UI ↔ engine.** All calls go to the engine's REST API, documented in `docs/API.md` and `docs/OPENAPI.json`. Generate a thin typed client from the OpenAPI document. A cross-origin setup or a reverse proxy is the implementer's choice; record the choice in the README.
- **Workspace on disk.**
  - A Project is a folder of YAML documents (Appendix A) that the user can keep in git.
  - Owner amendment A-2: the browser uses one minimal workspace service to list, read and write YAML files only inside the mounted ./workspace folder, bound to loopback.
  - The service validates YAML syntax only, makes no engine calls, and has no AQEF or Contract logic.
  - It rejects traversal, absolute paths, and symlinks outside the folder.
  - It refuses keys password, api_key, token and secret (case-insensitive) and tells the author to use secret_ref.
  - On first start it seeds an empty folder from examples/aster/.
  - D-2 remains unchanged: all AQEF operations go from the browser to the engine API.
  - **Apply** sends it to the engine through the API.
  - **Export** writes the engine's current configuration back to YAML.
- **Validation.**
  - The UI validates YAML against Appendix A/B as the user types, for convenience.
  - **The engine remains the authority.** A configuration the engine rejects at load is shown with the engine's message and the rule it cites. The UI never "fixes" it silently.
  - If no machine-readable schema exists in the AQEF repository at the tag, derive one from Appendix B and keep it in the UI repository with a note of its source.
- **Stack.**
  - TypeScript and a mainstream component framework, chosen and recorded by the implementer.
  - No server component beyond static hosting and the YAML-only workspace service authorized by amendment A-2.
  - Volume XIV expects the UI to sit on a TypeScript SDK. The generated client is the seed of one, but Stage 1 does **not** claim `sdk:typescript`.

## 4. `aster-sim`: the simulated subject and Judges

A small service derived only from the engine's documented provider protocol (`docs/PROVIDERS.md`), as confirmed by owner amendment A-1. It answers by Scenario, with fixed behaviour, so every run is reproducible. No external harness or specification test material is used.

**Subject `aster-sim-subject@1`.** Aster Support AI is a refund and account support assistant. Behaviours are selected by Scenario or row:
- a correct, grounded answer;
- an unsupported claim (a wrong refund amount);
- a retrieval miss (the governing policy is absent from the returned context);
- a claimed completion without the tool outcome;
- a wrong tool argument;
- a correct refusal;
- an over-refusal of an answerable question;
- a slow response.

Each answer carries the retrieved context and tool calls as artifacts, in the engine's documented shapes.

**Judges:**
- `aster-sim-judge-reliable@1`;
- `aster-sim-judge-blind@1`, which misses one defect class;
- `aster-sim-judge-overcall@1`, which flags clean items;
- `aster-sim-judge-down@1`, which never answers.

These make the trust mechanisms visible: Admission, defect and clean Seeded Controls, `oracle_unavailable`.

**Sample workspace.** Ship an `examples/aster/` workspace with:
- the Project, Environment, Suites and Scenarios;
- the Contracts and Gates;
- a static Dataset;
- a small human-labelled Reference Set.

It must load and run as is.

## 5. Screens

Names follow Volume XV where it names them. Each screen states the AQEF sections it depends on.

| # | Screen | What it does | Spec |
|---|---|---|---|
| S-1 | **Connections** | Shows the provider identifiers the engine has mapped and whether each answers. Read-only in Stage 1: mapping is engine configuration, not AQEF configuration. Shows `secret_ref` names, never values. | Engine `PROVIDERS.md`; D-4 |
| S-2 | **Workspace** | YAML editor with schema checks; Apply, with a diff preview of what will change in the engine; Export; engine load errors shown verbatim. | App. A, B |
| S-3 | **Visual Test Designer** | Forms for Scenario, Contract clauses (Constraints, Expectations, dimension, clause id), Dataset binding. Edits the same YAML document. The YAML diff is always visible. | Vol XV; Vol VII; App. A |
| S-4 | **Test Explorer** | Read-only browsing of Projects, Suites and Scenarios. For each Scenario: its Suites, Baseline status and latest Result. No edit path outside S-2 and S-3. | Vol XV |
| S-5 | **Validator Designer** | Built-in and Custom Validators. There is no Confidence field. A check that needs a model is refused with the reason and a link to Judge Configuration. | Vol XV; Vol V |
| S-6 | **Judge Configuration** | Single Judge and Multi Judge, Consensus or Voting, Confidence thresholds. A panel cannot be saved until a purpose (independence or stability) is chosen. | Vol XV; Vol VI; App. A §A.7 |
| S-7 | **Admission** | Lists Admission records; the most recent accepted record decides. A form to record one, with Reference Set and version, distribution, raw agreement, the named chance-corrected measure and the threshold. A helper computes the numbers from a labelled Reference Set file and shows the arithmetic. A threshold is entered **before** the results are shown. Never offers to "revoke": withdrawal is a newer record with `admitted: false`. | Vol VI, Admission; App. C §C.3 |
| S-8 | **Runs and Evidence** | Start a Suite × Environment run. Executions show their Results with disposition, verdict and Confidence. Every Result opens its Evidence: Conversation, retrieved context, tool calls, the Oracle configuration, and the resolution chain. Human Review and re-assessment actions are available where the API offers them. | Vol I, Ch. 6; App. C §C.7 |
| S-9 | **Seeded Controls** | Defect and clean controls by defect class, and their outcomes: caught, missed, passed, false_alarm, invalid. Confirmation is shown, and so are the Results each control invalidated. | Vol VIII |
| S-10 | **Gates, Reports, Dashboard** | Gate check showing, for each Gate: status, blocking or advisory, value or "not computed", Basis, and **every** reason. Reports are frozen and show their generation time. The Dashboard is a live view of the same Suite. The two must not be mistakable for each other. Overrides go through Approval Workflow and name the one GateResult they cover. | Vol XV; Vol XI; Vol I, Ch. 6; Vol XII |

## 6. UI rules (apply to every screen)

1. **No headline score.** The top-level result of a run is Gate decisions with their Basis, not a single number.
2. **Every number opens to its evidence:** Gate → aggregate and Basis → Results → Evidence.
3. **Absence is never green.** `oracle_unavailable`, `awaiting_review`, `inconclusive`, `not_assessed`, invalidated, stale and "not computed" each have their own visual state, distinct from pass and from fail.
4. **No hidden defaults.** The UI never fills a field the specification leaves to the author. Where the engine applies a documented default, the UI shows that it did.
5. **Every visual edit shows its YAML diff** before it is applied.
6. **Terms exactly as in the AQEF Glossary** (Appendix D). Labels may explain a term; they never rename it.
7. **At Risk is labelled.** Any control touching an At Risk feature, such as an Action Boundary field, carries an "At Risk in 1.0-CR1" marker.
8. **Engine errors are shown verbatim**, with the specification rule they cite where the engine gives one.
9. **No secret value is ever displayed, logged, exported or sent to the engine.**

## 7. Slices

Each slice ends with the following, as with the engine:
- a working build, started from one command;
- automated end-to-end tests (for example, Playwright) for what the slice adds;
- an updated README;
- a list of ambiguities found in the specification, recorded rather than decided silently.

| Slice | Content | Done when |
|---|---|---|
| **UI-1** | Repository, compose file, `aster-sim`, S-1, S-4, the sample workspace loads | `docker compose up` gives a working Test Explorer over the sample workspace |
| **UI-2** | S-2 and S-3: YAML workspace, schema checks, Apply with diff, Export, Visual Test Designer | Independent Volume XV visual/YAML equivalence check passes (owner C-3; no CTS claim); Export then Apply round-trips with no difference |
| **UI-3** | S-5, S-6 | CT-RUI-002 and CT-RUI-003 pass on inspection |
| **UI-4** | S-8: runs, Results, Evidence, Human Review, re-assessment | A run of the sample Suite shows every disposition `aster-sim` can produce, each opening to its Evidence |
| **UI-5** | S-7, S-9: Admission and Seeded Controls | The blind Judge is caught by a defect control; the overcalling Judge by a clean control; the arithmetic shown matches a hand calculation |
| **UI-6** | S-10: Gates, Reports, Dashboard, overrides | CT-RUI-004 passes on inspection; a Gate failing for several reasons shows them all |

## 8. Engine gaps (record; do not change the engine in Stage 1)

| # | Gap | Stage 1 handling | When it matters |
|---|---|---|---|
| G-1 | No endpoint lists the mapped providers or their health | S-1 calls each provider's health endpoint, or reads the compose configuration | Stage 1, convenience |
| G-2 | No way to send an authorization header to a provider; URLs only | Not needed: simulated providers only | Stage 3: add `secret_ref`-based headers to the engine's provider mapping |
| G-3 | No bulk "apply this workspace" endpoint; the API is per resource | The UI orders the per-resource calls and reports partial failure clearly | Stage 3, CI |
| G-4 | Dashboards have no API resource; Volume XI leaves the interface open | The UI builds the live view from Results | — |
| G-5 | No read proving current Baseline validity | Display recorded Baseline only; regression Gate deferred | Later Baseline slice |
| G-6 | Per-resource writes must each leave a valid Project; no Suite PUT | Preview atomic inline Project replacement and ordered external-resource writes; report partial failure | Workspace Apply |
| G-7 | No read-only effective Contract endpoint | Independent check compares engine-frozen Execution Contracts; UI does not compose them | Visual/YAML equivalence |
| G-8 | No GET stored Gate evaluations; Approval reads omit some override metadata | Show observed responses and saved Report copies only, with source/time labels and explicit missing fields; latest means latest known | Gates, Dashboard and Trend history |
| G-9 | Evaluation Result IDs are not per-Gate membership or per-Result staleness; Report Gate copies omit some evaluation/definition fields | Show evaluation-wide IDs and stale reason; never invent contributing subsets, per-Result stale flags or frozen metadata | Evidence drill-down and frozen Report completeness |

Any further gap found is added here, not worked around silently.

## 9. Conformance at the end of Stage 1

- **Automated:** CT-RUI-001, run against the UI and engine.
- **Inspection:** CT-RUI-002 to 004, decided by a named external reviewer and signed. This is the same arrangement as the engine's inspection tests.
- A **Conformance Statement** for `reference_ui`, together with the engine's core and `multi_judge`, published in the UI repository.

If all four pass, `reference_ui` has the implementation evidence it needs before Candidate Recommendation ends.

## 10. For the owner to confirm before work starts

1. Repository name: `aqef-reference-ui`.
2. Licence: Apache 2.0.
3. Engine tag to pin: the latest at the start of work.
4. Whether the external reviewer for the inspection tests is the same as for the engine.
