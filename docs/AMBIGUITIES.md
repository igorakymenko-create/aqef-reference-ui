# UI-1 ambiguities and engine gaps

## UI-A01 — Stage brief references forbidden external test material

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
