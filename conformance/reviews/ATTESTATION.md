# Attestation of the CTS 1.8 review records for aqef-reference-ui

I, Igor Akymenko, owner of the AQEF project and of this repository, attest the
following.

## The records

| Record | Test | Reviewer | Decision |
|---|---|---|---|
| `CT-RUI-002.gemini-2.review.json` | CT-RUI-002 | `reviewer://google/gemini-3.8-flash` | PASS |
| `CT-RUI-003.gemini-2.review.json` | CT-RUI-003 | `reviewer://google/gemini-3.8-flash` | PASS |
| `CT-RUI-004.human-1.review.json` | CT-RUI-004 | `person://alona-marchenko` | NOT_RUN |
| `CT-RUI-004.human-2.review.json` | CT-RUI-004 | `person://alona-marchenko` | PASS |

The records are kept exactly as they were finalized. Their `signature_ref` reads
`pending://owner-attestation`. The commit that adds this file and the records is their
signature (Harness Contract §13). GitHub authenticates that commit as made by my account.

## The AI inspector (CT-RUI-002, CT-RUI-003, and the CT-RUI-004 evidence)

1. **Who.** Google Gemini, run in Google Antigravity on my computer, acted as an
   independent inspector. It did not write this UI, the engine, or the CTS. The UI was
   written by OpenAI Codex. Gemini can neither sign nor hold an account, so I sign for it.
2. **What it was given.** The repository at commit `0a4302e`, the three Volume XV rules
   and the tests' text verbatim, CTS 1.8, and the review record schema. It was told:
   - not to read the implementer's own checks and notes before finishing;
   - to design its own scenarios for finding any route around each rule;
   - to show, not assert, that nothing was saved after a refusal.
3. **Run r1 was rejected and is not used.** Its CT-RUI-004 description contradicted its own
   screenshots: Gate names that do not exist, times that do not match the captions, and
   a Dashboard capture taken before the page had loaded. One cited file was missing. The
   owner's assistant (Claude, Anthropic) found this by checking every statement against
   the screenshots.
4. **Run r2** (`evidence/gemini-r2/`) was made to correct r1. Every refusal cited in the
   records is backed by:
   - the SHA-256 of `./workspace/project.yaml` before and after;
   - a read-only engine response before and after, byte-identical.

   Both were checked independently of the inspector's account. The r2 capture scripts were
   not kept. The evidence can be captured again from the same commit, but not by
   re-running the identical scripts.
5. **Run r3** (`evidence/gemini-004-r3/`) captured the CT-RUI-004 evidence again on commit
   `60c354e`. Its script is kept in `scripts/`. It records the system clock's UTC time at
   the start.
6. **Clock note (r1 and r2).** All times in r1 and r2 (captions, `actions.jsonl`,
   `signed_at`, and the engine's and browser's timestamps) come from my computer's clock.
   On 2026-11-01 that clock was one hour ahead of UTC: the time zone had switched
   automatically from UTC−7 to UTC−8, and the local time was then corrected by hand
   without changing the zone. Subtract one hour to obtain UTC. Every time comes from that
   one clock, so the order of events and the intervals between them are unaffected. The
   clock was corrected before r3.

## The human reviewer (CT-RUI-004)

7. **Who.** Alona Marchenko decided CT-RUI-004. She is my wife. She had no part in the
   UI's development and had not seen these screens before. The relationship is stated in
   her records' `affiliation`. She agreed to be named in this public record.
8. **Step 1, 2026-11-02.** Before any evidence, she was shown two first screens without
   URLs (`evidence/human-ct-rui-004/step-1/`; captured by the owner's assistant from
   another instance of commit `0a4302e`) and asked which was the frozen Report. She
   chose correctly ("B"), cued by the words "Frozen Report", and rated her answer
   "guessing". I recorded her answers. The cue is my paraphrase.
9. **Round 1, 2026-11-08: NOT_RUN.**
   - She answered plain-language questions (`round-1/STEP-2.md`) on the r2 evidence, in
     an answer form she filled herself (`round-1/*.xlsx`).
   - The CTS-style checklist first prepared for her was replaced before she used it,
     because it was not understandable to a reviewer without context.
   - She could not decide whether the Report showed the moment it was frozen, and found
     "Current state may differ" misleading.
10. **The fix.** The wording was changed in commit `60c354e`. The original wording came
    from the owner's prompt to the implementer, not from the implementer's own choice.
11. **Round 2, 2026-11-08: PASS.** She answered the same questions (`round-2/`) on the r3
    evidence. One of her remarks says there is "still no 'frozen at' phrase". As she
    clarified through me, it refers to the block under the Report title, not to the
    banner. Her record states this.
12. **Translation.** Her answers were given in English. No translation was involved.
13. **Mapping to the checklist.** The owner's assistant mapped her answers to the checklist
    items as described in each record's `notes`. Her answers are quoted verbatim in the
    items' notes.

## Deviation

14. **CT-RUI-004 names the fixture F-SIGNALS.** This repository's rules forbid CTS material,
    so the Report and Dashboard come from the UI's own sample Project, with the same Suite
    and Environment for both. The reviewer was asked whether this changes her answers, and
    said it does not.

Signed through the commit that adds this file.
