# Conformance evidence

| Path | Content |
|---|---|
| `CONFORMANCE-STATEMENT.md` | What this UI claims (`reference_ui`), and the CTS results |
| `reviews/` | The CTS 1.8 review records for CT-RUI-002 to 004, and the owner's attestation |
| `evidence/gemini-r2/` | The AI inspector's run r2: evidence for CT-RUI-002 and 003, and the first CT-RUI-004 evidence |
| `evidence/gemini-004-r3/` | The AI inspector's run r3: CT-RUI-004 evidence after the wording change, with its capture script |
| `evidence/human-ct-rui-004/` | The human review of CT-RUI-004: the blind step, and each round's questions and filled form |

CT-RUI-001 is an automated test. Its run, report and evidence are in
[aqef-cts-harness](https://github.com/igorakymenko-create/aqef-cts-harness/tree/main/runs/r261108160634).

**Resolving `evidence://` references.** A record names each evidence file as
`evidence://<file>`. The file is in the run folder that the record's `notes` (or this
table) names:
- `CT-RUI-002.gemini-2` and `CT-RUI-003.gemini-2`: `evidence/gemini-r2/evidence/`.
- `CT-RUI-004.human-1`: `evidence/gemini-r2/evidence/`.
- `CT-RUI-004.human-2`: `evidence/gemini-004-r3/evidence/`.
- `step1-blind-*.png`: `evidence/human-ct-rui-004/step-1/`.

Every screenshot carries a caption strip, outside the page, with its URL and capture
time. The `.txt` file next to it holds the page's visible text at that moment.

**Signature.** The records in `reviews/` and `ATTESTATION.md` were added, and so signed,
by commit [`f586f1e`](https://github.com/igorakymenko-create/aqef-reference-ui/commit/f586f1e)
(Harness Contract §13). They were then moved into this folder, unchanged.