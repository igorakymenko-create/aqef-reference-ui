# Implementation notes

## UI-1 — Foundation, Connections, Test Explorer

Scope: Stage 1 brief UI-1, S-1 and S-4. Normative basis: AQEF 1.0-CR1 Volume XV
(Test Explorer), Appendix A (Project/Environment/Suite/Scenario/Contract/Dataset/Gate),
Appendix C (configuration/runtime reads, pagination, authentication). Provider wire
contract: reference engine slice-12 PROVIDERS.md. No external test materials accessed.

Implemented: React/TypeScript static UI, generated OpenAPI declarations/thin client,
read-only Explorer and Connections, deterministic Aster subject/four Judges, authored
workspace and Reference Set, Compose startup/proxy/seeding, engine source pin and
hash verification, Apache 2.0 licence, own API and browser checks.

There is no fake data fallback. Unavailable engine reads are errors; empty collections
remain visibly empty. Refresh rereads the engine. Connections explicitly separates
transport health from quality. The sample includes a Contract with deterministic
Constraints, a Judge Expectation, a blocking Gate and eight Scenarios including a
Static Dataset binding. No Admission or Baseline is pre-granted.

The browser never receives the Principal token. The public deployment mapping has
no credentials. No secret value is sent to a provider or written into AQEF configuration.
Server-inserted bearer authentication is sent only to the engine authentication API.

No applicable SHOULD was intentionally skipped in the UI-1 normative scope. Full
Volume XV coverage is deferred to the specified later UI slices, not claimed complete.
Schema derivation/validation and on-disk authoring belong to UI-2. Engine gaps remain
recorded in AMBIGUITIES.md; no changes were made to the engine.

### Verification

* Five own integration checks passed on the pinned package: all simulator behaviours
  and Judge profiles, sample API load/run/Gate failure, unavailable Judge disposition,
  authorization/empty history, byte-for-byte engine hashes.
* OpenAPI client generated from the pinned snapshot.
* `npm run build` passed (strict TypeScript and production Vite build).
* All five Playwright end-to-end checks passed against the real pinned engine,
  simulator and local proxy. Desktop and 390-pixel mobile captures were visually
  reviewed. A mobile overflow caused by an absolutely positioned table label was
  corrected and the full browser suite rerun successfully.
* On this Windows sandbox the runner stalled during child-process teardown;
  the final browser run used an approved execution outside the sandbox and exited
  successfully. This is an execution-environment limitation, not a browser pass
  inferred from a hung run.
* Docker Compose was subsequently verified on Windows with Docker Desktop engine
  29.9.2 and Compose 5.6.1. `docker compose up -d --build --wait` built all three
  images, automatically loaded Aster and started nginx on loopback port 3000.
  No application or engine changes were needed for the container deployment.
* Three additional Playwright checks passed against the running Compose deployment:
  Explorer/sample/authentication, all provider health states, and a real eight-Scenario
  Suite execution with frozen Evidence and an engine-evaluated failed Gate.
  Unauthenticated access directly to the engine returned 401; the nginx API proxy
  authenticated successfully without a browser-supplied token.
* Restarted engine and UI, waited for readiness, and verified all eight Execution IDs
  were unchanged. Startup reported that the existing Project was preserved.
  The generated local `.env` stayed ignored by git and its value was not displayed.

No CTS test result, signed external inspection or conformance statement is asserted.

## UI-2 — Workspace and Visual Test Designer, with owner UI-1 corrections

Owner amendments A-1/A-2 are recorded in STAGE-1-BRIEF.md; the exact UI-2 request is
retained in UI-2-REQUEST.md. UI-A01 is resolved. Work began on codex/ui-2-workspace
from main after the owner-authorized merge of UI-1 PR #1.

* Corrected the subject/Judges: no answer-key Artifact; six visible property tags,
  deterministic rules over Conversation/retrieved context/tool calls, narrow blind
  amount omission and currency-only false alarm. Added hand-written Evidence checks.
* Labelled Results by clause (including unnamed positions), Oracle kind/identifier,
  disposition/verdict, Confidence/not applicable, recorded resolves and individual
  Evidence links. No combined Scenario verdict or resolution logic was added.
* Added the YAML-only, loopback workspace service, first-start seeding, nested tree,
  optimistic revisions, atomic writes, no-follow path confinement and recursive
  secret-key rejection. It has no engine calls, AQEF validation or Contract knowledge.
* Added CodeMirror YAML editing, committed prose-derived authoring schema, Scenario,
  Variables/Dataset and inline clause forms. The schema source/provenance and its
  configuration-only scope are explicit; no full B.1 schema conformance is claimed.
* Both authoring paths use one diff/plan/confirmation flow. Plans inventory resources,
  mark governed changes, show each dependency-ordered call, recheck freshness and
  report complete/no changes/failed/partial with every call outcome. Inline resources
  use the existing atomic Project API; external registries use their own endpoints.
* Export reads the engine's definitions and registries, previews YAML changes and
  refuses an export that would subsequently require engine changes. Documented
  defaults are comparison-only; no values are inserted into visual author fields,
  and explicit null is preserved for engine validation.
* No engine source, provider wire shape, governance policy, existing database record
  or historical Result was changed. UI-3 to UI-6 remain out of scope.

Verification: all 11 Python checks passed (including file confinement,
secret-key guard, first-start seeding, simulator property variants and exact vendor
hashes). All 12 browser checks passed, including the five original UI-1 checks,
Result-label/resolution rendering, non-coercing schema checks, visual/YAML equivalence
of all API fields and engine-frozen effective Contracts, unchanged Export/Apply,
real partial failure/verbatim error, new-Project registry dependency order and secret
request/output suppression. Production TypeScript/Vite build passed. Compose verification is recorded below. No CTS or external inspection pass is
asserted. No applicable SHOULD was intentionally skipped in this slice's scope;
documented API/schema limitations remain explicit in AMBIGUITIES.md.

Final UI-2 Compose verification: all four services built and started with the existing
engine data volume. All four browser checks against the built nginx deployment passed,
including applying the corrected sample through the shared preview. All four file-service
checks also passed inside its Linux container, including outside-folder symlinks.
The 16 Executions present before a coordinated restart retained exactly their IDs;
the workspace Project YAML retained exactly its SHA-256 revision. The active browser
bundle was checked against the local bearer credential and contained no token.
A final comparison regression verifies that an omitted Execution setting is distinct
from an explicit skip_class override, preserving Project/Suite inheritance. No
Execution default is materialized by the authoring comparison. The final Docker
production build and four deployment browser checks passed after that correction.
