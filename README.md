# AQEF Reference UI

Local, single-user presentation and authoring layer for AQEF 1.0-CR1. **UI-1**
implements Connections (S-1), Test Explorer (S-4), and the Aster simulated workspace.
This slice does not claim `reference_ui` conformance. UI-2 through UI-6 remain to be built.

## Start locally

Prerequisite: Docker Desktop with Compose v2 and Linux containers. Before the first
launch, copy `.env.example` to `.env` and replace the sample token with your own
letters/digits/dots/underscores/hyphens. Keep `.env` out of git. Then:

```sh
docker compose up --build
```

Open **http://localhost:3000**. Subsequent starts use `docker compose up`.
The first build needs network access for container images and pinned dependencies.
All published ports bind only to loopback. There are three long-running services:

* `engine`: unchanged reference engine, port 8000, persistent SQLite volume;
* `aster-sim`: scripted subject and Judges, internal port 9100;
* `ui`: static React/TypeScript application in nginx, port 3000.

Startup waits for the simulator, then loads `examples/aster/project.yaml` through
the engine REST API as the bootstrap Person (`admin`). The engine records the
governed Contract definition. If the Project already exists, startup preserves it,
including changes and history. It never silently overwrites the running Project.
An import rejection fails startup and prints the engine's error body.

`docker compose down` stops the services and retains the database. Changing the
bootstrap token does not rotate an existing Principal's stored credential: retain
the token used for that database. Do not remove the volume unless you intend to
discard all local history.

## What to inspect

* **Test Explorer**: browse Project and Suite definitions, filter eight Scenarios,
  inspect their Contracts, Dataset binding, recorded Baselines, latest Execution,
  its engine Results and frozen Evidence. There is no edit or execution control in
  this slice. An empty history reads **Not run**, never pass.
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
  Python launch scripts supervise the unchanged engine and seed via its API.

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
on loopback (ports 8000, 9100, 9191, 3000). Its credential is generated in memory;
its temporary database is separate from the user's database. Tests cover browsing,
search, unavailable providers, verbatim engine errors, narrow layouts, and a real
run with Evidence. These are independently authored checks, **not CTS tests**.

To check a running Docker Compose deployment instead of starting development
servers:

```sh
npm run test:e2e -- --config playwright.docker.config.ts
```

These three checks browse the built static UI through nginx, check provider health
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

UI-2: YAML workspace, schema checks, Apply diff, Export, Visual Test Designer.
UI-3: Validator Designer and Judge Configuration. UI-4: runs and Evidence workflows.
UI-5: Admission and Seeded Controls. UI-6: Gates, frozen Reports and live Dashboard.
An external reviewer for final inspection remains to be named by the owner; that
does not block UI-1. No CTS pass or signed inspection is claimed by this build.

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
