# AQEF Reference UI

Local, single-user presentation and authoring layer for AQEF 1.0-CR1. **UI-3** adds
Validator Designer (S-5) and Judge Configuration (S-6) over the shared Workspace YAML
and Review & Apply flow. Connections (S-1), Workspace (S-2), Visual Test Designer
(S-3) and Test Explorer (S-4) remain available. No `reference_ui` or CTS conformance
is claimed; UI-4 through UI-6 remain.

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
* `aster-sim`: scripted subject and Judges, internal port 9100;
* `workspace`: YAML-only file service, port 9200, host-mounted `./workspace`;
* `ui`: static React/TypeScript application in nginx, port 3000.

Startup waits for the simulator, then loads `examples/aster/project.yaml` through
the engine REST API as the bootstrap Person (`admin`). The engine records the
governed Contract definition. If the Project already exists, startup preserves it,
including changes and history. It never silently overwrites the running Project.
An import rejection fails startup and prints the engine's error body.

The workspace service separately seeds an empty `./workspace` from `examples/aster/`.
Existing files are never overwritten by seeding. To adopt the UI-3 sample in an
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
* **Test Explorer**: browse Project and Suite definitions, filter eight Scenarios,
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
quality aggregation, Gate evaluation or Admission decision. Raw runtime records are
displayed as JSON in this foundation slice. Baseline records are not presented as a
proof of current validity; see [recorded gaps](docs/AMBIGUITIES.md).

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
These are independently
authored checks, **not CTS tests**. Stop the user Compose deployment before the
development checks because they use the same ports; its database volume is retained.

To check a running Docker Compose deployment instead of starting development
servers:

```sh
npm run test:e2e -- --config playwright.docker.config.ts
```

These five checks browse the built static UI through nginx, check provider health
and authentication, and run the sample Suite through the real containerized engine.
The run intentionally remains in the local database as eight Executions with Results
and Evidence; the sample Gate fails because the simulator includes known defects.
The checks can be repeated without resetting the database. Compose startup and
preservation of that history across an engine/UI restart have been verified.

To regenerate the engine vendor snapshot from a local engine checkout that contains
the pinned commit: `python scripts/vendor_engine.py PATH_TO_ENGINE_CHECKOUT`.
The script reads only `engine/*.py`, `requirements.txt`, `LICENSE`, and the named
OpenAPI document. No conformance or other specification test material is accessed.

See [implementation and verification](docs/IMPLEMENTATION_NOTES.md),
[ambiguities and gaps](docs/AMBIGUITIES.md), and [simulator contract](docs/SIMULATOR.md).

## Next slices

UI-3: Validator Designer and Judge Configuration. UI-4: runs and Evidence workflows.
UI-5: Admission and Seeded Controls. UI-6: Gates, frozen Reports and live Dashboard.
An external reviewer for final inspection remains to be named by the owner; that
does not block UI-1. No CTS pass or signed inspection is claimed by this build.

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
