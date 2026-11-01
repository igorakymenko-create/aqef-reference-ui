# Implementation notes

## UI-6 review fixes — F-1 and F-2

F-1 was a real SimulatorControl race: an initial GET could settle after the POST
and overwrite its reported outage state. Initial reads now carry the write revision
at which they started; responses and errors from an earlier revision are discarded.
Effect cleanup also discards reads from an obsolete mount. Both buttons are disabled
until the initial state is known. The existing three-link recovery check explicitly
waits for that state before clicking. A new route-controlled check holds the two
development StrictMode initial reads, verifies both unknown-state buttons disabled,
releases one read, performs the real POST off, then delivers the stale initial on
response. Both the screen and simulator remain off. No timer-based route sleep or
expect-timeout increase is used.

F-2 was unrelated full-history traffic from the RunsScreen parent. On a direct
Execution route it still mounted the Runs index's effects: read Projects, choose
the default Project, page through all its Executions and request every Execution's
Results. These competed with the selected Execution's already-parallel evidence
reads. RunsScreen now gates the history loader on the current list route, including
after an in-flight collection read settles. It preserves the existing component's
form/filter state when navigating between the list and an Execution. The first
prototype unmounted the index and the complete suite caught a form-state regression;
that prototype was discarded before the final verification runs. A detail page no
longer fetches the Execution collection or unrelated Results. The existing Project
metadata read remains; it took 98ms in the final measurement.
The UI-5 invalidation check now asserts that no Execution collection or unrelated
Results request starts when opening either invalidated Execution.

Read-only measurements used the same stored invalidated Execution and database,
first with the original built UI and then with only the UI rebuilt. Original:
306 API reads, invalidation visible at 6,009ms; unrelated Results requests reached
22,821ms. Final correction: seven API reads, invalidation visible at 2,974ms; the
slowest required read was the selected Execution's Results at 2,666ms. Conversation,
Artifacts, Roles and Requalifications were fetched in parallel. No engine endpoint,
data, aggregate or timeout was changed. These are observed local measurements,
not a performance guarantee on other machines.

Remaining F-2 API limitation: the pin offers an Execution-scoped Results collection,
but no individual-Result GET. The required scoped read itself took 2,666ms in this
measurement; the UI cannot omit it or invent current invalidations from cached data.
No endpoint was added and no longer expect timeout masks this remaining API cost.

The first full one-CPU attempt exposed an additional fixture dependency: the
captured-human subject took 344ms against the inherited 200ms latency Constraint.
The engine correctly returned an actionable Validator failure and no Human Result;
waiting longer could never create a Review button. With the owner's explicit
approval to change test fixtures only, the disposable service launcher now copies
the example into its temporary workspace and moves that unchanged latency
Constraint from the check Project's inherited Contract onto its
slow-response Scenario. The deliberately guarded recovery Scenario also keeps it.
Human/Judge interaction fixtures therefore do not depend on the host meeting 200ms;
the actual latency failure/short-circuit check remains. The checked-in Aster sample,
simulator, engine and all timeout settings are unchanged. Setup updates only the
temporary test workspace before either service starts, and the unchanged bootstrap
imports that copy through the normal engine API. This applies from UI-1 onward:
moving it only at UI-4 was too late for Explorer's Judge Evidence check under CPU
stress. Human completion checks compare the original and final Result IDs rather
than assuming an extra inherited latency Result.
The earlier failed CPU attempt is not counted as successful verification.

A later strict-CPU attempt hit an unrelated transport refusal during Workspace
Export: Vite received ECONNREFUSED from the local fixture listener on port 9200 and
showed HTTP 500, not a late successful result. The stdlib fixture servers' default
five-slot TCP listen queue could overflow under a connection burst on one CPU.
Only the disposable launcher configures their listen queue to 128. The simulator
and YAML service implementations, endpoints, validation, deadlines and data semantics
remain unchanged. No retry or timeout increase conceals the refusal.

Verification uses Windows x64, Node 24.13.0, Python 3.12.1 and the pinned Playwright
1.56.1 Chromium. Each complete run invokes `npx playwright test --reporter=line`
with the checked-in configuration, fresh disposable services/database, and no timeout
or retry override. The Windows equivalent of `taskset -c 0` used here is a Job Object
with JOB_OBJECT_LIMIT_AFFINITY and mask 1, assigned to the verifier before launching
the CPU series. Process affinity inheritance alone was insufficient: Chromium
expanded one sandbox child's mask back to the system mask. The Job Object prevents
that expansion for the complete subprocess tree. The launcher samples live current-
run descendants using Toolhelp/GetProcessAffinityMask, including Node/Vite, the
Python engine/simulator/workspace services and Chromium `headless_shell.exe`.
Each sample rebuilds the tree from the current npx shell. The constrained verifier
exits after its CPU series; no
machine-wide CPU setting is changed.

Final verification on this source passed six consecutive complete invocations:
three normal runs (182.23s, 181.19s, 181.22s), followed by three one-CPU runs
(272.66s, 278.19s, 279.31s), each 46/46. The original five-second assertions remain
unchanged. A separate preliminary complete CPU run also passed 46/46 (280.84s),
but is not substituted for any run in that six-run sequence.

The third CPU run's raw collector flagged five unrelated msedge.exe processes at
the system mask, despite all Node, Python, esbuild and test Chromium processes
having mask 1. Windows had recycled their long-gone parent PIDs into the test tree.
Their live StartTime values were independently checked: all five started at
20:16:33, before the CPU run began around 20:55. The audit correction excludes
those pre-existing processes only; the original raw flag, process samples and test
logs are retained locally. All test-process samples in all three CPU runs have mask
1, and the Job Object enforced that constraint throughout. The Playwright exit
code was 0 in each run, including the third CPU run.

The final production build and all 12 Python integration checks also pass; the
vendor hash check confirms that the pinned engine is unchanged. The Python checks
still load the original committed Aster sample, not the isolated browser fixture.
Compose was restored healthy after verification. The read-only preservation check
matched all 528 Execution IDs, six frozen Reports and 30 workspace revisions from
the existing delivery baseline; both active static assets remain credential-free.

## UI-6 — Gates, frozen Reports, live Dashboard and decisions

`src/decisions/api.ts` reads production API collections and retains actual Gates
check responses in session memory. It joins engine-owned Report Gate copies to
Snapshot metadata, without reading a database or calculating values, rates, Basis,
reasons or status. G-8 is visible: other sessions' unreported evaluations cannot be
listed; Report-backed timestamps are captured_at, never substituted evaluated_at.
History is therefore latest-known, not globally complete. Exact GateResult IDs
prevent override inheritance across evaluations. Read omissions remain explicit.

Gates check sends only execution_batch_id and always evaluates the complete applicable
map. Cards retain every reason and all Basis fields, ThresholdMap and metric_basis,
with blocking/advisory wording. Numeric links open exactly the returned evaluation
IDs, grouped by clause and linked to UI-4 chains; Metric links use their own IDs.
G-9 prohibits invented per-Gate subsets and per-Result stale flags. A Report copy
without IDs or an aggregate definition says so instead of splicing in current data.

ReportDocument is a separate application root: it mounts no workspace, shared live
reader or Dashboard poller. It fetches its own document only. The warm paper background,
serif document title, scope block and sticky amber “Frozen Report — generated at”
banner identify a frozen artifact even without the URL. Gates use their frozen
override references only. All six signal lists remain visible, including empty none;
exact signal objects and the complete document remain under disclosures. The line
“Current state may differ; this Report does not change.” is unconditional, requiring
no prohibited live read. Navigating to evidence leaves the document view.

Dashboard uses the application navigation, green live header, card/grid layout,
“Live view — updates as new Results arrive” and last successful refresh time. It
never labels a timestamp generated_at. A five-second interval reads API data, with
unmount cancellation and an in-flight guard; it does not check Gates or generate
Reports. ResultCounts matches Explorer's labelled counts, not a verdict. Open work
uses actual dispositions/invalidated_by and latest accepted Admission flags. The
small Trend plots recorded Gate values only; null/not_computed breaks paths rather
than becoming zero. Coordinate scaling is not an AQEF aggregate.

Override POSTs identify exactly one failed blocking GateResult and require a reason;
the response preserves fail with Approval metadata. Missing historical approval time/
Role is labelled, never inferred from current membership. Frozen Reports never join
live Approvals. Concurrent forms exercise an actual 201 then 409. Additional tests
exercise real 403 and 404 bodies. Release forms have no default decision and send
the documented five fields; the engine decides validity. A changed clause produces
an actual stale 409 shown verbatim. Recorded decisions retain advisory failures.

The added ten-Scenario decision Project leaves the original twenty intact and
demonstrates all requested Gate cases without weakening inherited Contracts. The
existing Role/Principal APIs provision/check gate_override, release_decide and review.
No dependency, server, SQL reader, workspace journal or engine change was added.
Baselines/regression, Release Policies and broader Trends remain deferred.

The first final triple run passed twice, then its third pass hit a separate local
transport failure during Admission's shared Apply preflight: Vite logged connect
EADDRINUSE to 127.0.0.1:8000 and returned HTTP 500. This was not the A-1 recovery
failure (that test passed). Vite's bundled http-proxy sets agent=false and forces
Connection: close unless an Agent is supplied. The development API proxy now uses
a bounded Node HTTP keep-alive pool (16 active/8 idle sockets), avoiding connection
churn across repeated suites. No retry, assertion timeout or engine change was used.
The initial failed attempt is not counted as three successful consecutive runs.

After that transport correction, three complete consecutive disposable runs passed:
12/12 Python integration checks and 45/45 browser checks in each run (browser
durations 3.4m, 3.3m, 3.2m). No retries were configured. The production TypeScript/Vite
build passed; the vendor hash verification in each Python run confirms the pinned
engine remains byte-for-byte unchanged.

The owner-only Docker sample-adoption check is outside the disposable 45-check
suite. Its multi-Apply/run workflow initially exceeded the default 30-second total
against retained history. It now uses the same 120-second workflow/30-second locator
budget as the existing Docker regression configuration. It also waits for Apply's
post-save reload to finish before selecting another file: the completion heading
precedes that reload, so selecting early could be overwritten by the active-file
reload. This deployment synchronization is separate from A-1; the recovery check's
timeouts and retry policy remain unchanged.

The rebuilt Compose deployment passed sample adoption (1, 50.5s), existing nginx/
Runs regressions (6, 2.5m), trust workflows (9, 1.6m), and decision workflows
(8, 52.8s): 24 checks in total. The owner Project has a retained decision batch
and frozen Report for inspection. A coordinated Compose restart retained all
528 Execution IDs, six frozen Reports (full-record hashes) and 30 workspace file
revisions exactly. Both active static assets were scanned against the bootstrap
and derived Person credentials; neither value is present. The prior preservation
baseline's 298 Execution IDs were also retained. No volume or workspace was reset.

## UI-6 — UI-5 corrections

The UI-4 outage check borrowed the second shared product batch. That Project's
200ms latency Validator ran before the flaky Judge; host scheduling could fail the
Validator and short-circuit assessment, leaving no Judge Result for the test to
re-check. The check now owns a fresh recovery Project with no inherited latency
guard on its recovery Scenario, explicitly sets the simulator outage before running,
and restores it in finally. A second, deliberately slow Scenario reproduces the old
path: the original 200ms Validator fails and the engine returns no Judge Result.
The recovery Scenario still proves exactly three engine links with one unchanged
Oracle and no further subject calls. No retry or timeout increase is used for this fix.

Invalid control labels now use an outcome's recorded reason if supplied, otherwise
`invalid — no reason recorded by the engine`. The pin does not include a reason in
its per-Oracle outcome records; its control-level reason is specifically for full-run
invalidation and is not repurposed as an invalid-outcome diagnosis. Confirmed controls
are never described as unconfirmed by inference. Full-run invalidation forms are
collapsed until explicitly expanded.

Reference Set version 3 has 26 illustrative labelled items. Two additions deliberately
expose content-rule limits: an unsupported loyalty bonus that the amount/duration
grammar misses, and the faithful `$49.00` versus `$49` formatting it overcalls. For
the reliable configuration one exposed item is excluded: the 25-item table is
[[11,1],[1,12]], raw agreement 0.92, chance agreement 0.5008 and κ about 0.840.
The blind configuration includes all 26 items: [[13,0],[13,0]], κ 0.000. At a
predeclared 0.800 threshold the workflow records admitted true and false respectively.
Labels and case names never enter Judge Evidence. Displayed agreement and Confidence
use three decimals; exact arithmetic and engine request/response values are retained.
Before implementing the reporting slice, all 37 UI-1–UI-5 checks passed three complete
sequential runs on fresh disposable services (2.8m, 2.7m, 2.7m). The recovery check's
guarded short-circuit reproduction and three-link recovery both passed in every run.

## UI-5 — Admission, Seeded Controls and readable Evidence

Completed the UI-4 presentation corrections first: Conversation/Artifacts/Results
precede the collapsed frozen configuration; criteria/explanation/chain position are
plain, raw Oracle/provider/attempts/full records are disclosed, panel members are a
table. The low-Confidence approximation now explains its uncertainty without changing
its verdict or rating. No recorded Evidence is rewritten.

S-7 records pre-results declarations with Person/time and Reference Set snapshots in
auxiliary workspace YAML, generates fixed-Evidence diagnostics through shared Review
& Apply, runs the pinned engine, presents independent agreement arithmetic and submits
only documented Admission fields. Exposure filtering, undefined measures and incomplete
measurements are explicit. Later threshold changes remain visible and persisted;
accepted records are append-only and their last admitted flag decides status. Exact
model/criteria/confidence_source identity separates workflows. Diagnostic Projects and
classes prevent their construction-control misses from disqualifying product Oracles.

S-9 adds shared-YAML control authoring and batch views of engine control records apart
from product Results. Actual invalidated_by links go both ways and retain the original
verdict. Permission-gated Human confirmation, explicit full-run invalidation and
Requalification show engine outcomes/refusals verbatim. Corrected assessment uses
engine-recorded candidate Oracles and appends resolving Results against stored Evidence;
freshness, chronology, complete kind coverage and compatibility remain engine decisions.

The sample has a versioned 20-item illustrative Reference Set and eight new instrument
Scenarios across original/fresh control Suites (20 Scenarios total). General schema and
latency Constraints declare their own classes instead of claiming unsupported-amount
coverage. No engine source, file-service semantics, authentication contract or package
dependency changed. API/provenance choices and SHOULD limitations are UI-A21–UI-A25.

Independent verification covers the 2×2 arithmetic against separate calculations,
undefined/single-class scores, exact Admission request fields and acceptance order,
exposure exclusion, declaration files, threshold change provenance, multi-document
control authoring, engine misses/false alarms/invalid controls, negative confirmation
refusal, actual invalidated_by links, reused-control refusal, fresh Requalification
and corrected actionable chains without subject calls. The full UI-1–UI-5 browser
suite contains 36 checks; the Python suite contains 12, including exact vendor hashes.
The production TypeScript/Vite and four-service Compose builds pass. Built nginx
checks include the owned-sample Review & Apply migration, six deployment regressions
and eight UI-5 workflows. Fresh sample Projects used by the latter are explicit
shared-Apply resources so earlier control exposure is preserved rather than cleared.
Desktop Evidence/Admission and 390px Admission/Controls were visually reviewed;
both narrow workflows have no horizontal page overflow. No external test material
was accessed and no CTS or external inspection pass is claimed.

After a coordinated Compose stop/rebuild/start, all 298 then-existing Execution IDs
across the sample/diagnostic Projects and all 14 workspace SHA-256 revisions matched
exactly, including saved Admission plans. Both active browser assets contained neither
server credential. Persistent-deployment regression checks allow 120 seconds per
workflow and 30 seconds for visible data: this pin's history/control reads on the
accumulated database can exceed short development waits. No history is cleared to
make those checks pass.

## UI-4 — Runs and Evidence

Added S-8 over the pinned engine API: synchronous new-batch execution without Gates,
all returned Execution records, paginated/filtered history grouped by batch, dedicated
Execution URLs, ordered transcript, readable context/tool Artifacts, recorded latency
and usage, frozen configuration, clause Results and complete panel output. Results
follow only recorded resolves links, retain earlier links and label the latest link.
The UI performs no Gate-effective-state calculation or quality aggregation.

Human Review forms enforce explicit verdict/reason and frozen capture-policy controls;
uncaptured Confidence is omitted. Route/Role information is displayed as returned.
Engine currency/permission refusals stay verbatim. Pending Human completion is labelled
as the engine's sole in-place exception. Same-Oracle unavailable recovery sends the
exact frozen string, keeps every returned chain link and calls no subject. Corrected
Oracle actions are disabled until UI-5 Requalification.

Extended the simulator/sample with approximate-amount (pass/0.6 against threshold 0.8),
flaky unavailable/recovered Judge, direct Human sign-off and a three-member independent
panel. The outage control is a separate loopback listener/proxy, explicitly labelled
as a simulator feature. Role/Principal API bootstrap provisions a local review Person
without changing the engine, existing admin Principal or Role. No token enters browser
code. No new package dependency, file-service semantics or engine source changed.

Independent checks cover complete/failed Executions, repeat-batch retention, Human
resolution/capture omission, real Role 403 and stale 409, three-link unavailable recovery
with no subject call, panel member data, filtered lists, actual run preflight 404/422,
and API pagination across a batch boundary. Earlier checks remain in the dependency
chain. Specification/API prose alone was used; no external test material was accessed.

Verification: 12 Python checks passed, including vendor hashes and hand-written
approximation cases. All 27 UI-1–UI-4 browser checks passed, including 201-record
pagination, a batch crossing an API page, and mobile Evidence without horizontal
overflow. TypeScript/Vite and four-service Compose builds passed. The extended
12-Scenario sample was reviewed/applied through the existing workspace flow, run,
and checked for scoped Oracle clauses. All six nginx/Docker browser checks passed,
including Role-authorized Human completion and the unavailable/unavailable/actionable
recovery chain. After an engine/UI restart, all 92 then-existing Execution IDs and
the workspace revision matched exactly; both active asset files contained neither
the bootstrap nor derived local-Person credential. Existing history was retained.

## UI-3 — Oracle designers and UI-2 corrections

S-5/S-6 share WorkspaceScreen's draft, YAML diff, plan and confirmation. Pure rule
registrations use scoped YAML documents and POST /validators before dependent
Contracts/Project updates. Export includes registry definitions. No engine source
or workspace file-service semantics changed. No new dependencies were introduced.

oracleRules.ts applies mandatory authoring refusals to both forms and YAML before
saving or issuing engine writes, and rechecks at confirmation. Family and changed
Judge configuration notices are advisory. Admission is paginated and read-only.
contractEditing.ts edits the chosen document and attachment through the YAML AST.
Incomplete forms clear any prior proposed YAML. Explorer uses a collapsed Result
histogram while retaining the full UI-2 Result renderer on expansion.

The sample correction was reviewed/applied through the running UI-2 before UI-3
completion; its eight Scenarios were re-run and frozen Contracts and Judge Results
checked against explicit property scopes. checks/sample-scope.spec.ts records this
repeatable check. Own integration and browser checks cover prior slices and the
five UI-3 refusal/warning requirements; they use no external conformance material.

Verification: 11 Python integration/file-service checks, 19 UI-1/UI-2/UI-3 browser
checks, five built nginx deployment checks and the eight-Scenario sample scope
check passed. TypeScript/Vite production and four-service Compose builds passed;
all services became healthy using the existing database volume and workspace.
Vendor checksums match the committed source manifest. The sample's frozen effective
Contracts and every new Judge Result contain only their explicitly exercised properties.

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
