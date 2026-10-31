# Ambiguities and engine gaps — UI-1 / UI-2 / UI-3

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
