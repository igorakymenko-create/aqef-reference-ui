# Prompt for Codex — Reference UI, slice UI-4: Runs and Evidence

Read `AGENTS.md` and `docs/STAGE-1-BRIEF.md` first, and work on a new branch from `main`.

The usual rules hold:
- derive behaviour from AQEF `1.0-CR1` and the engine's documented API (`docs/API.md` at the pin), never from conformance-test material;
- keep the engine unchanged;
- record ambiguities and engine gaps in `docs/AMBIGUITIES.md`;
- the UI decides nothing the engine decides.

Out of scope here:
- Gates, Reports and the Dashboard (UI-6);
- Admission, Seeded Controls and Requalification (UI-5).

---

## Part A — Simulator and sample additions

The current sample cannot show the states this slice must present. Add the following, all deterministic and documented in `docs/SIMULATOR.md` and `examples/aster/README.md`.

**A-1. A low-Confidence case, which leads to `inconclusive`.**
- Add a subject case `approximate-amount`. It answers "about $50" where the retrieved policy says "$49.99".
- Under its grounding rule, the reliable Judge returns `pass` with a **lower Confidence** (for example 0.6) for an approximate figure that is close to a figure in the context. The rule is stated in `SIMULATOR.md`.
- With the sample's Confidence threshold above that value, the engine records `inconclusive`. The UI never computes this; the engine does.

**A-2. A recoverable outage, which leads to `oracle_unavailable` and then re-assessment.**
- Add `aster-sim-judge-flaky@1`. It returns HTTP 503 while a simulator switch is on, and judges normally while it is off.
- The switch is a simulator control endpoint outside the AQEF provider protocol, bound to loopback. Connections shows it as a labelled **simulator control**, not as an AQEF feature. Turning it off is the only way to make the Judge answer again.
- Use this Judge for one sample Scenario.
- Keep `aster-sim-judge-down@1` unchanged: it is never recoverable.

**A-3. Direct Human Review.** Add one sample Scenario with a direct Human Expectation, `human_reviewer: {role: …}`, as the engine documents it. It produces an `awaiting_review` Result.

**A-4. A Multi Judge panel.** Give one sample Scenario a panel (reliable, blind and overcall), with an explicit purpose of `independence`, so that panel output and disagreement can be shown.

**A-5. Roles.** Make sure the local single user can perform the review actions the sample needs (review permission and the routed Role). Do this through the engine's documented Principal and Role API at bootstrap. Do not do it by weakening any check.

## Part B — Slice UI-4: Runs and Evidence (S-8)

### B-1. Start a run

Choose a Suite and an Environment, then start a run with the engine's `POST /projects/{project}/executions`.
- **Do not request Gates in this slice.**
- The call is synchronous. Show the `execution_batch_id` and every Execution returned, **including failed ones**, labelled as infrastructure failures, not quality verdicts.
- Preflight errors (404, 422) are shown verbatim, with the engine's `detail`.

**Running again** is allowed and always creates a **new batch**. It never replaces, hides or supersedes an earlier batch.
- Show earlier batches next to the new one.
- No control may suggest that a later run "fixes" an earlier Result.
- Volume III restricts retry to infrastructure failures, and re-running the subject after an unfavourable verdict is not a retry. State this in one line next to the run control.

### B-2. Runs list

The list comes from `GET /executions` with its filters (Suite, Environment, status, dates) and pagination, **grouped by batch**. For each batch show:
- its time;
- its Suite and Environment;
- the number of Executions;
- the same "counts, not a verdict" histogram as Test Explorer.

### B-3. Execution detail: Evidence

One page per Execution, built only from what the engine returns:

- **Conversation:** turns in order. A missing transcript (409) is shown as "no completed transcript", never as empty success.
- **Artifacts:**
  - `retrieved_context` as readable source/text records;
  - `tool_calls` as a table (tool, arguments, outcome where recorded);
  - latency and usage as recorded.

  Any artifact the UI does not recognise is shown as raw JSON.
- **Frozen configuration:** the Environment, the resolved Contract and the Oracle configurations exactly as frozen in the Execution. Label it "frozen at execution; later configuration changes do not apply here".
- **Results, by clause:** each Result shows:
  - its Oracle;
  - its disposition and verdict;
  - Confidence or "not applicable";
  - `recorded_at`;
  - its supporting evidence: criteria, provider response, explanation, attempts;
  - for a panel, every member's verdict and the panel counts as the engine recorded them.

### B-4. Resolution chains

Results linked by `resolves` are shown as a **chain**, oldest first, each with its own record.
- The most recent link is labelled **"latest in this chain"**.
- Earlier links stay visible and are never struck through or hidden.
- The UI follows only the recorded `resolves` links. It does not infer invalidation, effective state for Gates, or anything else the engine has not returned.

### B-5. Human Review

Offer a review action **only** where the engine's documented rules allow one:
- on a current `inconclusive` Result;
- on an `awaiting_review` Human Result, routed to a Role the user holds.

Show the `review_route` the engine returns: Role, state, timeout, required Roles.

**The review form:**
- **Verdict:** pass or fail, chosen explicitly, with no default.
- **Supporting reason:** required.
- **Confidence:** offered only when the clause captures Confidence. In that case it is numeric, between 0 and 1, and required. Otherwise the field is absent and **never sent as null**.

**After review:**
- An inconclusive Judge Result gains a new Human Result that resolves it. The original stays visible.
- An `awaiting_review` Result completes in place. Show that this is the engine's single documented in-place completion.

Engine refusals (403, 409) are shown verbatim.

### B-6. Re-assessment of an unavailable Oracle

Offer "Re-check with the same Oracle" **only** on a current `oracle_unavailable` Result. Send the exact frozen Oracle string, as the engine requires. The subject is not called; state this on the control.
- If the provider is still down, the engine records a new `oracle_unavailable` Result in the chain. Show it as such, not as an error.
- Re-assessment with a *corrected* Oracle needs Requalification. That belongs to UI-5: show the action as unavailable here, with that reason.

## Part C — Your own checks (independent, not CTS)

1. A run shows every Execution the engine returned, including an infrastructure failure, without labelling it a quality verdict.
2. A second run of the same Suite appears as a new batch, and the first batch's Results are unchanged and still listed.
3. `approximate-amount` produces an `inconclusive` Result as recorded by the engine. A review adds a Human Result that resolves it, and the chain shows both.
4. The flaky Judge produces `oracle_unavailable`. A re-check while the switch is on adds a second unavailable link. After the switch is turned off, a re-check adds an actionable Result. All three links stay visible.
5. The direct Human Expectation is `awaiting_review`, and review completes it. A review attempt without the required Role is refused by the engine, and the refusal is shown verbatim.
6. A review form for a clause that does not capture Confidence never sends a Confidence field.
7. Panel output shows each member's verdict as recorded, with no verdict computed by the UI.
8. Every earlier check still passes.

## Done when

- Parts A to C are complete and `docker compose up` brings everything up with the extended sample.
- The README, `docs/AMBIGUITIES.md`, `docs/IMPLEMENTATION_NOTES.md` and `docs/SIMULATOR.md` are updated.