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
