# Ambiguities and engine gaps — UI-1 through UI-6

## UI-A27 / G-8 — Stored evaluation history and override metadata reads

**Source:** UI-6 D-2 says to record a missing read rather than compute aggregates;
Appendix C and the pinned API expose POST Gates check, Report/Snapshot collections,
and Approvals, but no GET stored Gate evaluations. Treating Report generation time as
evaluation time or reading SQLite would invent data or bypass the API boundary.

**Choice:** retain actual check responses in session memory and combine them with
engine-owned Gate copies in saved Reports, deduplicated by Snapshot. Snapshot
`captured_at` is explicitly labelled as such; it is never called `evaluated_at`.
Unreported evaluations from other sessions cannot be shown. Save a Report to retain
an API-readable copy. The limitation is visible on Gates and Dashboard, including
Trend and latest-known override eligibility. This is not a complete global history.

Approval reads can identify an accepted override by its exact target GateResult,
but omit the POST response's approval time/Role fields. Use actual POST metadata
when available; otherwise state that the engine did not return it. Never infer
historical Role from current membership or call an Approval's creation time its
approval time. Reports use only their own frozen override reference and never
join live Approvals. The engine remains authoritative on concurrent action refusals.

## UI-A28 / G-9 — Evidence membership, staleness and frozen metadata

**Source:** UI-6 C-3 requires the Results listed by the engine, and D-1 prohibits
live enrichment of a frozen Report. Check responses list evaluation-wide result_ids,
not each Gate's contributing subset. They report stale_results at Gate level but
do not flag individual Results stale. Frozen Report Gate copies omit result_ids,
evaluated_at and some Gate definition/override metadata.

**Choice:** open exactly the evaluation-wide IDs, group recorded Results by clause,
and label the membership limitation. Show stale_results on its Gate/evaluation,
without marking arbitrary individual Results stale. Missing IDs/aggregate definition
or metadata remain explicitly missing, never reconstructed. Metric drill-down uses
the Metric's own recorded result_ids. Evidence destinations are separate pages;
the frozen Report itself fetches only its own document. No current configuration
or Approval is spliced into it. No engine or file-service extension is introduced.

## UI-A29 — Decision sample scope and minimum basis

**Source:** UI-6 B-1 requires several semantic failure reasons in one accepted run
and correctly scoped Gates. The original sample's inherited latency Constraint can
short-circuit Judges before semantic Results exist. Weakening those Contracts would
change earlier demonstrations.

**Choice:** add a separate aster-support-decisions Project, ten Scenarios and five
Project Gates. Keep the original twenty Scenarios intact. Only decision-slow has
the latency Constraint. The safety Gate sees an awaiting_review Human Result and
unmet min_basis, producing the engine's not_computed/insufficient_basis. Minimum
basis alone does not guarantee not_computed at this pin: after Human completion the
engine may return a numeric value with min_basis_met false. Display it unchanged.

UI-6 B-3 calls override_requires a Role; Appendix A and the pin define it as a
permission name. The sample requires review, supplied by the existing aster-reviewer
Role; the Person also holds admin's gate_override and release_decide. Bootstrap uses
the documented APIs and verifies permissions without overwriting existing identities.
The engine chooses the recorded approval_role; the UI shows that value, which may
be admin rather than aster-reviewer.

## UI-A26 — An invalid control outcome has no recorded diagnosis at this pin

Owner UI-6 A-2 requires the actual reason and prohibits labelling a confirmed control
unconfirmed. The pin's per-Oracle objects contain oracle, outcome and result_ids but
no reason. A null verdict can yield invalid even when confirmed is true. The outer
control's reason describes full-run invalidation, a different event. The UI therefore
shows `invalid — no reason recorded by the engine` when the outcome has no reason,
and preserves confirmation and full records separately. It does not infer a cause
from dispositions, provider responses, or confirmation flags.

## UI-A21 — Fixed Evidence for Reference Set scoring

UI-5 asks for fixed-Evidence Scenarios in a dedicated Suite. A.4 and the pinned
Scenario API permit fixed Evidence only on construction Seeded Controls. Generated
Admission Suites therefore live in their own explicitly diagnostic Projects, with
one isolated class per item. Otherwise a diagnostic miss would disqualify the same
Oracle's product assessments through the engine's control rules. No subject is called.
The generated YAML is reviewed/applied through Workspace. Its explicit diagnostic
Confidence threshold 0 collects verdicts without changing the Oracle identity; it
is visibly distinguished from the Person-declared agreement threshold. Scores use
actual returned verdicts, never a recomputed disposition. The plan binds an exact
Oracle, Reference Set snapshot/version and item Evidence; source drift refuses a run.

## UI-A22 — Negative confirmation is refused by this pin

UI-5 D-4 requests true/false confirmation. Volume VIII defines confirmation of actual
presence/absence; the pin's ConfirmRequest rejects false with 422. The form retains
both explicit choices and sends the chosen value with a required reason. It shows
the engine rejection verbatim and leaves an unconfirmed control invalid. It never
pretends false created an accepted confirmation record. Fixed Evidence/source provenance
is supported only with construction; Validator/Human confirmation uses captured subject
Evidence. source_execution alone is not an executable binding: the UI copies an existing
transcript and Artifacts into FixedEvidence with provenance, refusing repeated Artifact
names that cannot be losslessly represented by the pin's name→data map.

## UI-A23 — Reference Set provenance and exposure

The sample is an illustrative simulation, not an independently conducted Human
labelling study. It declares the provisioned local Person as the labeller for local
review/submission and says so in its provenance and UI note. Independent blind
labelling, multiple sources, arbitration and separation from tuning remain SHOULDs;
a single labeller warns without blocking. The sample's exposed item identifies the
exact tuned Oracle. exposed true without exposed_for excludes it for every Oracle;
exposed_for accepts exact Oracle strings or explicit model identifiers. No exposure
is inferred from string similarity. The included/excluded IDs and Reference Set snapshot
are stored with the declaration. These are workspace conventions, not engine DTO fields.

## UI-A24 — Agreement and incomplete measurements

Only Cohen's κ is supported and is named explicitly. The UI presents the human×Judge
2×2 table, both marginals, observed/expected agreement, substituted formula and κ.
Single-class human labels or an undefined denominator produce not_computed and a
proposed admitted false. Missing Judge verdicts do not disappear from the denominator:
κ is not_computed, and submission is disabled because this API also requires a numeric
raw_agreement with no not_computed representation. No value is invented for it.
verdict_distribution is the distribution of the declared correct Human labels, per
Volume VI. Threshold changes after viewing are allowed, visibly annotated, and saved
with Person/time history before submission; the original declaration remains recorded.
Plans use optimistic file revisions. A newer admitted false record can withdraw an
earlier status only through a payload satisfying the documented comparison rule.

## UI-A25 — Control scope and requalification affordances

Volume VIII treats undeclared clause classes as covering every tested class. The
sample's general response/latency Constraints therefore name their own classes, so
an unsupported-claim defect is not accidentally a missed schema/latency test. Product
and control Results are presented separately; only returned invalidated_by creates
an invalidated label/link. Engine blocked_by on not_assessed Results is retained too.
Accepted Requalification records provide candidate corrected Oracles covering the
returned classes; the UI does not reimplement freshness, control-kind or compatibility
validation. This pin checks complete kind coverage again at reassess. A control reused
from a miss is refused by the API and that refusal remains visible. Full-run invalidation
is an explicit reason-bearing action and never a silent change to original verdicts.

## UI-A17 — Local reviewer identity without a current-Principal endpoint

Owner UI-4 A-5 requires review permission and the routed Role via documented APIs.
The pin exposes POST /principals, POST/GET /roles, but no current-Principal read or
Principal update. Bootstrap therefore creates a new Person `aster-local-person`
holding admin and `aster-reviewer`; it creates/checks the review Role through the
API, leaving the existing admin Principal and Role untouched. The UI proxy uses that
Person's distinct server-only credential, derived as SHA-256 of the bootstrap token
plus `:aqef-reference-ui-person-v1`, consistently in Python, Vite and nginx startup.
The bootstrap token is never rotated or replaced. No credential enters browser code.

Non-secret config/person.json describes this deployment-owned identity, explicitly
not a fabricated engine /me response. Affordances use its configured Roles and the
engine's GET /roles permissions; the engine authorizes every submitted action.
Bootstrap verifies the derived credential is accepted and fails if required admin
permissions are missing. A pre-existing Person id is not overwritten on 409; absent
a Principal-read endpoint, a manually altered conflicting deployment may still be
refused at action time. Such refusals remain verbatim. No check is weakened.

## UI-A18 — Infrastructure status and filtered/paginated batches

The API guide describes “failed executions”; actual pinned records use the status
`infrastructure_failure`. The UI preserves the recorded value and labels it as an
infrastructure failure without a quality verdict. Status filters use the actual
queued/running/completed/infrastructure_failure strings. No failed Execution is
dropped because it lacks Results or a completed transcript (409).

GET /executions paginates Executions, not batches. To avoid showing a page fragment
as a complete batch, read every matching engine page before grouping; then paginate
the display by ten batches. With status/date filters, label counts as matching
Executions only. Result histograms count returned records, including earlier chain
links; they are explicitly counts, not a verdict or an effective Gate basis.

## UI-A19 — Current chain actions and frozen Human Confidence

Volume I Result Resolution and the pin's review/reassess API allow only a current
link. The UI follows recorded resolves references only; it does not compose Contracts,
infer invalidation or calculate effective Gate state. Returned invalidated_by blocks
ordinary automated resolution affordances; corrected-Oracle actions are unavailable
with the UI-5 Requalification reason. Engine currency checks remain authoritative
if another action occurred since the last read; 403/409 are shown verbatim.

Review captures_confidence comes from returned review_route or the Execution's
frozen clause, not live configuration. An inconclusive Judge clause without a Human
capture policy offers no rating field and sends no confidence key. Verdict has no
default, reason is required, and captured ratings are required finite [0,1]. Pending
Human completion retains id/recorded_at and is labelled as the one documented
in-place exception; it is not turned into a fictitious resolution link.

## UI-A20 — Separate simulator control listener

Owner UI-4 requires a loopback control outside the provider protocol. Use a separate
9101 listener, loopback in development and loopback-published in Compose (private
container network internally), with a labelled UI proxy. The provider listener never
accepts control requests. Outage is process-local and starts on at each simulator
restart; it changes only by explicit control action. Historical Results never change.

## UI-A13 — Composition field location

Owner UI-3 says composition “within a clause”. Volumes V/VII and A.5 define
`policies.validator_composition` on Contract. The form edits that policy and never
invents a Constraint-level composition field. Effective composition remains engine-owned.

## UI-A14 — Custom Validator determinism and registration

The engine accepts only its pure closed rule DSL at POST /validators. The form
requires an explicit non-determinism answer; that answer is not an AQEF YAML field.
YAML registrations are restricted to the same DSL. Additional rejection signals:
mapped identifier in Constraint.validator/model/model_version, registry name or
name@version, registry/rule model/model_version; Confidence keys on Constraint,
registry or rule; unknown rule operation. Expected data and free prose are not
searched for model-like strings. A mapped identifier or explicit Yes offers a Judge
handoff preserving the draft. Unknown identifiers cannot imply a network operation
in the engine's closed DSL. Registry versions are immutable; changes require a new version.

## UI-A15 — Model family and Admission identity

Exact identity against every Project Environment is mandatory. Engine mapping has
no family metadata. The warning heuristic lowercases, removes @version, role suffixes
such as -subject/-judge and trailing vN/date suffixes. It is visibly labelled as a
heuristic, never a hard refusal or assurance of independence.

The engine has no separately configurable Judge prompt; criteria is the instruction.
Admission matches its documented http-judge-v1 identity exactly and uses the latest
append-ordered engine record's admitted flag. No metrics are recomputed. Threshold
is excluded from identity. Model, criteria or confidence_source changes warn of a
new configuration in form and preview. A future separate prompt field requires an
explicit protocol/identity update, not a speculative YAML field here.

## UI-A16 — Sample scope and row counts

Project clauses compose additively, so property Expectations moved to the Scenarios
that exercise them. Historical Evidence is preserved. Counts are a histogram of
returned disposition/verdict pairs, with invalidation shown separately; they are
not a Scenario verdict or ranking and never feed a quality decision in the UI.

UI-2 entries below record owner amendments and implementation choices; no engine
behaviour or historical records are changed.

## UI-A01 — RESOLVED by owner amendment A-1: forbidden external test material

**Source:** Stage 1 brief §4: “modelled on the scripted providers in `aqef-cts-harness`”;
§9 refers to external CT-RUI inspection. Project instruction: “Never access ... any
other test material for this specification.”

**Readings:** inspect that harness as an implementation reference; or derive the
simulator from the provider protocol and create independent checks from normative
specification requirements.

**Choice:** the explicit prohibition controls. Neither CTS nor its harness nor other
specification test material was fetched or inspected. The simulator follows only
the pinned engine's documented wire protocol. Own checks make no CTS claim. Final
external inspection is the owner's separate process.

**Resolution:** the owner removed the harness as a simulator source in UI-2 amendment A-1. The simulator is derived only from the pinned provider protocol.

## UI-A02 / G-5 — Current Baseline validity has no read-only status endpoint

**Source:** Volume XV, Test Explorer: “whether it has a Baseline ... its most recent
Result”. The engine's `/baselines` collection returns recorded designations including
configuration and Evidence; no per-Scenario current-validity resource is exposed.

**Readings:** compute validity in the UI from configuration/history; or display the
engine's recorded Baselines and explicitly state that validity is not evaluated.

**Choice:** show **Recorded · inspect** or **No Baseline**, never “valid”, “approved for
current configuration”, or a green success state. Display the full record in detail.
The UI implements no staleness/validity logic; the engine remains unchanged. This is
a limitation to revisit with the owner, not a claim that current validity is known.

## UI-A03 — Most recent Result when a Scenario has several clause Results

**Source:** Volume XV calls for “its most recent Result”; the engine emits one Result
per clause and appends resolution Results, across several Environments and Dataset rows.

**Readings:** collapse to one Scenario score/verdict; or display the most recent
Execution and all of its engine-returned Results, retaining their recorded identities.

**Choice:** the UI orders Executions by engine `created_at` (id breaks exact ties),
per Suite and Scenario, then presents all Results of the newest Execution. It shows
the Environment, row and timestamp in the raw Execution, with no cross-Environment
or Dataset-row aggregate and no derived resolution. Engine-provided invalidation
markers are displayed verbatim. This is a latest-Execution view, not a quality summary.

## UI-A04 / G-1 — Provider health is not an engine operation

**Source:** Stage brief G-1: “No endpoint lists the mapped providers or their health”.
Engine PROVIDERS.md: “No health handshake ... is implied.”

**Readings:** send a synthetic subject/Judge invocation as a reachability check; or
give the simulated provider a separate non-assessing health resource.

**Choice:** `/health/{model}` belongs only to `aster-sim`, not to the AQEF protocol.
Connections displays the shared deployment mapping and this health resource; the
engine never makes that health call and no Result is created. Failure/timeout is
unavailable/unknown, not pass. Actual quality decisions remain with engine requests.

## UI-A05 — Simulated tool artifacts versus acting subject capability

**Source:** Stage brief §4 asks for tool-call artifacts; engine scope excludes
`action_boundary` and acting subjects with tools.

**Readings:** enable a real tool configuration to exercise the simulator; or use
ordinary subject response artifacts with recorded fictitious calls.

**Choice:** `tool_configuration: null`. The simulator creates passive `tool_calls`
artifacts and invokes no tools. Wrong arguments and claimed completion are scripted
Evidence. No `action_boundary` capability or execution is claimed.

## UI-A06 — Zero-setup one-command start versus owner-provided local token

**Source:** Stage brief §3: “One command, one machine”; “admin token comes from a local
`.env` file that is never committed.”

**Readings:** ship a usable token/default in the build; or require first-time owner
setup of `.env`, then support a single Compose command for startup.

**Choice:** `.env.example` contains an explicitly replaceable example. Compose refuses
an absent token; no credential is baked into assets. One-time setup is documented,
after which `docker compose up` starts all three services and loads a missing sample.

## UI-A07 — RESOLVED by owner A-2: on-disk workspace needs a service

**Source:** original brief §3: "No server component ... beyond static hosting" and
"The UI reads and writes that folder." Static hosting cannot provide unrestricted
folder writes. The owner explicitly added the YAML-only workspace service in A-2.

**Choice:** one file service over ./workspace, with syntax/secret-key/path checks,
no AQEF logic and no engine calls. It conservatively rejects all symlinks. The amended
brief and docs/WORKSPACE.md record its exact protocol and first-start seeding.

## UI-A08 / G-6 — Per-resource Apply while every intermediate Project must be valid

**Source:** owner C-1: "per-resource calls in dependency order"; the pinned API exposes
Project replacement, but no Suite PUT. Whole-Project B.3 validation applies to each
configuration write. Updating a Contract and its consuming definitions separately can
make an intermediate graph invalid even when the final document is valid.

**Readings:** emulate missing methods or silently reorder until acceptance; or use
existing Project POST/PUT for its inline graph and explicit registry calls for external
resources. **Choice:** the second. The preview inventories each inline resource and
names the atomic Project call that covers it. Standalone Datasets and reusable
Contracts have separate calls in dependency order. A needed new Project namespace is
explicitly shown as a skeleton call, never hidden. All failures are reported; no rule
is weakened, no bulk endpoint or engine change is introduced.

## UI-A09 — Preview freshness and partial Apply are not a transaction

**Source:** owner C-1 requires diffs and every call outcome, including partial failure.
The engine offers neither a bulk transaction nor a conditional-write revision token.

**Choice:** compare source etags and the engine read set again before saving/calling;
refuse stale previews. Write the reviewed YAML, then issue the shown engine calls.
Keep the source if the engine rejects it; skip dependent calls for that Project and
show partial/failed plus verbatim responses. A race after the read-set check cannot
be eliminated without an engine API change. No claim of cross-resource atomicity or
implicit rollback is made. File writes themselves are optimistic and atomic per file.

## UI-A10 — Export, split files and authoring-schema scope

**Source:** Appendix A calls file splitting implementation-defined; B.1 lists schema
types beyond configuration authoring; owner C-1 asks for checks derived from A/B.

**Choice:** document project/owner/resource wrappers in WORKSPACE.md. Reject conflicting
contributions; identical definitions are allowed. Auxiliary labelled Reference Sets
are not treated as Project config. Export rewrites current definitions and registry
resources, updating existing scoped documents. Since the file service deliberately
has no delete endpoint, an obsolete scoped document is reported for owner removal,
never silently ignored. The committed schema is explicitly an authoring subset of
A.1-A.10/B.2 with the pinned engine's Static Dataset scope, not a complete B.1 runtime
schema or a conformance claim. Cross-resource B.3 acceptance belongs to the engine.

## UI-A11 / G-7 — Comparing effective Contracts without a read-only endpoint

**Source:** owner C-3 asks to compare the effective Contract through the engine; the
pinned API exposes the resolved Contract in frozen Execution configuration.

**Choice:** the independent browser check retrieves both Scenario definitions and
runs their Suite, then compares the engine-returned configuration.contract values.
The UI never computes a composed/effective Contract for this check. This also
exercises the two saved definitions; the check makes no CTS claim.

## UI-A12 — Owner correction B-1 removes the simulator answer key

**Source:** owner B-1: "Judges must judge content, not read the answer."

**Choice:** subject Evidence contains only retrieved context, passive tool calls and
normal engine/provider metadata. A leading visible criteria tag selects one content
property rule. Reliable, blind and overcall variants inspect Conversation and content
Artifacts, never fixture names or verdict labels. Blind skips only grounding amounts;
overcall's one false-alarm rule rejects any stated currency amount. Rules and their
limited deterministic grammar are documented in SIMULATOR.md. Historical engine
Evidence remains immutable, including records made before this correction.
