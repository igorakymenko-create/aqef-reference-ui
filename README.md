# AQEF Reference UI

Local, single-user presentation and authoring layer for AQEF 1.0-CR1. **UI-6** completes
the Stage 1 screen set with Gates, frozen Reports, a live Dashboard, single-GateResult
overrides and Release Decisions. Admission, Controls, authoring and Evidence remain
available. No `reference_ui` or CTS conformance is claimed. See the
[Stage 1 closeout and inspection map](docs/STAGE-1-CLOSEOUT.md).

## Start locally

Prerequisite: Docker Desktop with Compose v2 and Linux containers. Before the first
launch, copy `.env.example` to `.env` and replace the sample token with your own
letters/digits/dots/underscores/hyphens. Keep `.env` out of git. Then:

```sh
docker compose up --build
```

Open **http://localhost:3000**. Subsequent starts use `docker compose up`.
The first build needs network access for container images and pinned dependencies.
All published ports bind only to loopback. There are four long-running services:

* `engine`: unchanged reference engine, port 8000, persistent SQLite volume;
* `aster-sim`: scripted subject and Judges, internal port 9100; separate simulator
  control port 9101 published only on loopback;
* `workspace`: YAML-only file service, port 9200, host-mounted `./workspace`;
* `ui`: static React/TypeScript application in nginx, port 3000.

Startup waits for the simulator, then loads `examples/aster/project.yaml` and
`examples/aster/decision-project.yaml` through
the engine REST API as the bootstrap Person (`admin`). The engine records the
governed Contract definition. If the Project already exists, startup preserves it,
including changes and history. It never silently overwrites the running Project.
An import rejection fails startup and prints the engine's error body.

Bootstrap also creates/checks the sample `aster-reviewer` Role and creates the
local Person `aster-local-person` using the documented Role/Principal API. This
Person holds admin and the routed review Role. The UI proxy uses its distinct,
server-only credential derived from the bootstrap token; no extra setup or token
in the browser is needed. Existing Principals and Roles are not overwritten.
See [identity limitations and choices](docs/AMBIGUITIES.md#ui-a17--local-reviewer-identity-without-a-current-principal-endpoint).

The workspace service separately seeds an empty `./workspace` from `examples/aster/`.
Existing files are never overwritten by seeding. To adopt the UI-6 sample in an
existing workspace, copy the desired scoped Contract changes from the example into
the Workspace YAML editor, use **Review & Apply**, inspect the diff, then
**Confirm Apply**. The [sample scope table](examples/aster/README.md) explains which
properties belong to each Scenario. Existing engine history remains immutable.
See [workspace protocol and Apply behaviour](docs/WORKSPACE.md).

`docker compose down` stops the services and retains the database. Changing the
bootstrap token does not rotate an existing Principal's stored credential: retain
the token used for that database. Do not remove the volume unless you intend to
discard all local history.

## What to inspect

* **Gates**: choose `aster-support-decisions`, run `release-readiness` in Runs, then
  evaluate every applicable Gate for that batch. Five Gates show multiple reasons,
  full Basis, ThresholdMap, `not_computed`, an advisory failure and a blocking pass.
  Numbers open the engine-listed Results and UI-4 Evidence. Override names exactly
  one failed blocking GateResult; its recorded status stays `fail`.
* **Reports**: generate a frozen document with its generation time, scope, Snapshot,
  copied Gates, Metrics and all six signal lists. Its paper layout and persistent
  amber banner differ from the Dashboard. It makes no live reads or polls.
* **Dashboard**: green live view, last refresh time, five-second read-only refresh,
  recorded Gates, Result counts and linked open work. Trends plot engine values;
  `not_computed` leaves a gap. G-8 limits history to observed evaluation responses
  and engine-owned copies in Reports; other sessions' unreported evaluations cannot
  be listed by the pinned API. No quality aggregate is computed by the browser.
* **Release Decisions**: explicitly choose a Report, batch and decision, review the
  copied blocking/advisory Gate map, and submit notes. The engine accepts or refuses;
  immutable history keeps its original Gate map. See the
  [decision walkthrough](examples/aster/README.md#ui-6-gates-reports-and-release-decisions).

* **Admission**: the ordered workflow chooses an exact Oracle and Reference Set version,
  excludes exposed items, records a Person/time/threshold declaration in workspace,
  generates a diagnostic fixed-Evidence Suite for shared Review & Apply, then displays
  every step of Cohen's κ before submitting documented agreement evidence. Threshold
  changes after results remain allowed and visibly recorded. Accepted records remain
  in acceptance order; the last for each exact Oracle decides its current status.
* **Seeded Controls**: inspect recorded batch outcomes, confirmation, per-Oracle Result
  IDs and linked invalidated Results. Author controls over shared YAML/Apply. Record
  Human confirmation, explicit full-run invalidation or a diagnosis-backed Requalification
  using fresh control Results. Corrected assessment appends a new chain link and never
  calls the subject. The engine accepts/refuses every action. See
  [trust workflows and API boundaries](docs/TRUST-WORKFLOWS.md).

* **Runs and Evidence**: choose a Suite and Environment explicitly and start a new
  batch, without requesting Gates. Every returned Execution remains listed,
  including infrastructure failures. History is grouped by batch, with engine
  filters and pagination and counts labelled “counts, not a verdict”. Open an
  Execution for ordered Conversation, readable context/tool-call Artifacts, frozen
  configuration, clause Results and recorded panel members/counts. Resolution chains
  keep every link visible, oldest first. Review eligible Results or re-check an
  unavailable Oracle using its exact frozen string; the subject is not called.
  Engine refusals remain verbatim. See [Runs workflow](docs/RUNS-AND-EVIDENCE.md).
* **Connections → Simulator control**: switch the flaky Judge outage off/on. This
  separate simulator facility is labelled as outside AQEF. It never changes earlier
  Results, never resets through a run/re-check, and cannot recover the down Judge.

* **Validator Designer**: built-in Constraints, Contract composition, deterministic
  Custom Validator registration and binding. Model checks offer a draft handoff to
  Judge Configuration. Validator Confidence and mapped model identifiers block Apply.
* **Judge Configuration**: Single or explicitly chosen independence/stability panels,
  engine Consensus methods, visible omitted defaults and latest matching read-only
  Admission. Subject identity blocks Apply; family similarity warns. See
  [Oracle authoring](docs/ORACLE-DESIGNERS.md).
* Explorer rows start collapsed with disposition/verdict counts labelled
  **counts, not a verdict**. Expand a row for the full clause Results below.

* **Workspace**: browse the file tree, edit highlighted YAML with authoring-schema
  feedback, review created/changed/unchanged resources and diffs, confirm Apply,
  inspect every engine call outcome, or Export the engine's current configuration.
  Partial and failed Apply states retain the verbatim engine error. Export → Apply
  produces no changes. Names in `secret_ref` are plain names, never secret values.
* **Visual Test Designer**: choose a Project document and Suite, author a Scenario's
  Prompt, Variables/Dataset binding and Constraint/Single Judge clauses. All author
  fields start empty. Every change shows its YAML diff and uses the exact same
  Review & Apply path as the editor; the engine computes the effective Contract.
* **Test Explorer**: browse Project and Suite definitions, filter the twenty original
  Scenarios and ten separate decision examples,
  inspect their Contracts, Dataset binding, recorded Baselines, latest Execution,
  its engine Results and frozen Evidence. Entries are grouped by clause and show
  Oracle kind/identifier, disposition, verdict, Confidence/not applicable, recorded
  resolution references and individual Evidence links. Explorer stays read-only.
* **Connections**: inspect the exact startup provider mapping and each simulated
  provider's health. The `down` Judge intentionally shows **unavailable**. Provider
  availability is independent from a quality verdict.
* `examples/aster/`: authored YAML Project, static Dataset, Contracts, Gate, and a
  human-labelled simulation Reference Set. No Judge is automatically admitted.

The UI displays engine data; it performs no Contract composition, Result resolution,
quality aggregation or Gate evaluation. Admission arithmetic is shown for a Person's
review under the UI-5 authorization. Exact runtime records remain behind disclosures.
Baselines/regression Gates, Release Policies and broader Trends are deferred.
Baseline records are not proof of current validity; see [recorded gaps](docs/AMBIGUITIES.md).

## Source pins and architecture

* Framework: React 19.2, TypeScript 5.9, Vite 7.1. Exact dependency versions and lockfile.
* Specification: AQEF `1.0-CR1`, Volume XV and Appendices A–C, supplied with the engine.
* Engine: **slice-12**, commit `83c69e0defafe94e7f05282a1c2dd02c1d993d9e`,
  verified against GitHub tags at the start of work on 30 October 2026.
* `vendor/engine/`: byte-for-byte Python package, requirements and licence at that
  commit. [ENGINE-SOURCE.json](docs/ENGINE-SOURCE.json) records SHA-256 hashes.
  The original engine checkout is untouched. Vendoring makes builds reproducible
  without cloning other repositories or retrieving test material at build time.
* [engine-openapi.json](docs/engine-openapi.json): exact API snapshot at the pin.
  `npm run generate:api` generates `src/generated/engine.ts`; `openapi-fetch` is the
  thin typed client. Some runtime responses are unspecified objects in OpenAPI;
  the narrow view types in `src/api.ts` document that limitation. All collection
  requests follow the engine's offset/limit pagination.
* Reverse proxy: `/api/*` → engine; nginx inserts the local Principal token on the
  server. No bearer token enters frontend code, browser storage, URLs or bundles.
  The browser is trusted as the local operator of this single-user application;
  there is no separate web login. Do not publish this local proxy on a shared host.
* `/sim/health/*` reads the simulator's dedicated health checks. A single public
  `config/providers.json` supplies both the engine mapping and Connections (G-1).
  Its URLs contain no credentials. No AQEF configuration contains provider URLs.
* No custom UI application server. nginx serves static assets and proxies requests.
  Python launch scripts supervise the unchanged engine and seed via its API. The
  only additional application service is the owner's explicitly authorized YAML-only
  workspace service; it has no engine calls or AQEF logic.

## Development and verification

Python 3.12+, Node 22.12+ (Docker pins Node 24.13), and the Python packages in
`vendor/engine/requirements.txt` are needed for local development without Docker.

```sh
python -m pip install -r vendor/engine/requirements.txt
npm ci
npm run generate:api
npm run build
npm run test:integration
```

For browser checks, install Chromium in the ignored project-local directory:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.local/browsers'
npx playwright install chromium
npm run test:e2e
```

Playwright starts a disposable real pinned engine, simulator and Vite reverse proxy
on loopback (ports 8000, 9100, 9200, 9191, 3000). Its credential is generated in memory;
its temporary database is separate from the user's database. Tests cover browsing,
search, unavailable providers, verbatim engine errors, narrow layouts, and a real
run with Evidence. UI-2 checks also prove visual/YAML authorship equivalence using
all API fields and engine-frozen effective Contracts, Export → Apply round-trip,
real partial failure, dependency ordering and secret guards. UI-3 adds deterministic
registration and execution, mandatory refusals from forms and YAML, draft handoff,
Admission notices, explicit Multi purpose, both Consensus methods and registry Export.
UI-4 checks add new-batch retention, infrastructure failures, Human capture/Role rules,
resolution chains, outage recovery without subject calls, panel records, verbatim
preflight/currency errors and pagination across a batch boundary.
UI-5 adds readable Evidence/panel disclosures, pre-results Admission declarations,
exposure exclusion, independently checked agreement arithmetic, exact Admission
payloads and later withdrawal, control authoring, miss/false-alarm/invalid records,
confirmation refusals, invalidation, fresh Requalification and corrected chains.
UI-6 adds multi-reason Gates, immutable evaluation IDs, exact evidence drill-down,
Report isolation, Dashboard polling, gapped Trends, real override 403/404/409 and
stale Release Decision refusals. The complete development suite has 45 browser
checks and 12 Python integration checks.
These are independently
authored checks, **not CTS tests**. Stop the user Compose deployment before the
development checks because they use the same ports; its database volume is retained.

To check a running Docker Compose deployment instead of starting development
servers:

```sh
npm run test:e2e -- --config playwright.docker.config.ts
npm run test:e2e -- --config playwright.trust-docker.config.ts
npm run test:e2e -- --config playwright.decisions-docker.config.ts
```

These six checks browse the built static UI through nginx, check provider health
and authentication, and run the sample Suite through the real containerized engine.
Runs intentionally remain in the local database as batches of twelve Executions with
Results and Evidence. UI-4 run controls never request Gates; the retained older
deployment regression separately checks the pre-existing sample Gate API.
The checks can be repeated without resetting the database. Compose startup and
preservation of that history across an engine/UI restart have been verified.
The second command checks nine UI-5 workflows against the built deployment. It
records diagnostic Projects, Admission plans and control/recovery history in the
local workspace/database; it does not add the disposable authoring-test Scenario.
Each Compose workflow check starts a fresh `ui5-check-<uuid>` sample Project through
shared Review & Apply: previously exposed controls must not be reused as fresh
instruments. Existing Aster configuration and all history stay in place.
For an existing UI-4 sample, review/apply the UI-5 sample additions first; startup
preserves existing workspace files and engine Projects. The owned-sample migration
check is `npm run test:e2e -- --config playwright.sample.config.ts`.
The third command checks eight UI-6 workflows in a fresh decision Project through
the built nginx UI. These independent records remain as inspectable local history.

To regenerate the engine vendor snapshot from a local engine checkout that contains
the pinned commit: `python scripts/vendor_engine.py PATH_TO_ENGINE_CHECKOUT`.
The script reads only `engine/*.py`, `requirements.txt`, `LICENSE`, and the named
OpenAPI document. No conformance or other specification test material is accessed.

See [implementation and verification](docs/IMPLEMENTATION_NOTES.md),
[ambiguities and gaps](docs/AMBIGUITIES.md), and [simulator contract](docs/SIMULATOR.md).

## Inspection and deferred scope

An external reviewer for final inspection remains to be named by the owner.
CT-RUI-002–004 are ready for external inspection; no CTS pass or signed inspection
is claimed. Baselines/regression Gates (G-5), Release Policies, public deployment
and broader historical analytics remain outside this slice.

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
