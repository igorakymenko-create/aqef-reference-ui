# Stage 1 implementation and inspection map

This maps the implementation to the amended Stage 1 brief. Evidence comes from
independently authored checks against specification prose and the pinned engine's
documented API. No external specification test material was accessed. This document
makes no conformance claim, CTS pass claim or signed inspection claim.

## Screens

| Screen | Implementation | Independent evidence |
|---|---|---|
| S-1 Connections | `src/main.tsx`, provider health proxy/config | `checks/explorer.spec.ts`, `checks/docker.spec.ts`: provider mapping, deliberately unavailable Judge, real error |
| S-2 Workspace | `src/workspace/`, `workspace_service/` | `checks/workspace.spec.ts`, `checks/test_workspace.py`: diff/Apply, exact YAML/form equivalence, Export round-trip, partial failure, containment and secret guards |
| S-3 Visual Test Designer | `src/workspace/Designer.tsx`, shared preview/Apply | `checks/workspace.spec.ts`, `checks/schema.spec.ts`: empty author fields, schema refusal, identical API fields/frozen Contracts |
| S-4 Test Explorer | `src/main.tsx`, Result renderer/API | `checks/explorer.spec.ts`: search, read-only Scenario, latest Results/Evidence, mobile; G-5 recorded Baseline limitation |
| S-5 Validator Designer | `src/workspace/ValidatorDesigner.tsx`, shared Apply | `checks/oracles.spec.ts`: deterministic registration/execution, no Confidence, model check refusal/handoff |
| S-6 Judge Configuration | `src/workspace/JudgeDesigner.tsx`, Oracle fields | `checks/oracles.spec.ts`: explicit panel purpose, Consensus methods, visible omitted defaults, subject refusal, changed-configuration Admission warning |
| S-7 Admission | `src/trust/AdmissionScreen.tsx`, agreement helper, shared Apply | `checks/trust.spec.ts`: threshold declaration before results, exposure exclusion, independent exact arithmetic, exact payload, later false record, blind below threshold, not_computed |
| S-8 Runs and Evidence | `src/runs/`, Result renderer | `checks/runs.spec.ts`, `checks/trust.spec.ts`: separate batches, all dispositions/Evidence, panel table, Human Role/capture rules, three-link recovery without subject calls, pagination, readable disclosures |
| S-9 Seeded Controls | `src/trust/ControlsScreen.tsx`, shared YAML authoring | `checks/trust.spec.ts`: miss/false_alarm/invalid, confirmation, unchanged invalidated verdict, fresh Requalification, reused-control refusal, corrected chains, collapsed full-run action |
| S-10 Gates/Reports/Dashboard | `src/decisions/` | Eight `checks/decisions.spec.ts` workflows: all reasons/Basis/maps, NC, evidence IDs, evaluation history, isolated frozen Report, live polling, Trend gaps, exact-ID overrides/refusals, explicit Release Decision and stale refusal |

## Brief §6 UI rules

| Rule | Implementation | Independent evidence |
|---|---|---|
| 1 No headline score | GateCards at decision top; ResultCounts labelled counts, not a verdict | decisions/explorer checks assert Gate list and count labels, no headline score |
| 2 Every number opens to Evidence | Gate value/threshold/Basis links to evaluation-wide returned IDs; Metric links to its returned IDs; Result links to UI-4 chains | decisions checks navigate Gate → grouped IDs → exact chain and Metric → Evidence; G-9 limits recorded |
| 3 Absence never green | Disposition labels, NC block, stale reason, invalidated links; unavailable connection state | runs/trust/decisions checks assert each recorded state; NC never zero/pass |
| 4 No hidden author defaults | Empty author fields, explicit panel purpose/threshold/decision; omitted defaults labelled | workspace/oracles/trust/decisions checks cover no-default fields and engine default omission |
| 5 Visual edits show YAML diff | All designers propose to common Review & Apply | workspace/oracles/trust checks inspect diffs before accepted calls |
| 6 AQEF terms preserved | Result disposition/verdict, Confidence, Gate/Basis/Approval/Release Decision labels | All workflow assertions use API/spec terms and exact records |
| 7 At Risk labelled | WorkspaceScreen Action Boundary marker; Designer acting-tools marker; ValidatorDesigner refusals | Source inspection of those markers; authoring/schema checks cover the supported subset. No new At Risk feature in UI-6 |
| 8 Verbatim engine errors | Shared Failure renderer and Apply outcomes | workspace/oracles/runs/trust/decisions checks compare real refusal bodies including 403/404/409 |
| 9 No secret values | Server-only derived Person credential, nginx API proxy, YAML guards, ignored runtime files | Python integration/workspace checks and deployment active-asset scan; browser receives no bearer token |

## External inspection readiness

**CT-RUI-002, CT-RUI-003 and CT-RUI-004 are ready for inspection by an external
reviewer.** The owner has not named/signed that reviewer here. These identifiers are
inspection targets from the supplied brief, not claims of having accessed or run
external tests. For Validator/Judge inspection see `docs/ORACLE-DESIGNERS.md`; for
frozen/live screenshot distinctions see `docs/IMPLEMENTATION_NOTES.md`.

G-5 remains: Baseline validity/regression support is deferred. G-8 limits persisted
evaluation history and override metadata available through the API. G-9 limits
per-Gate membership, per-Result stale marking and frozen metadata. The UI exposes
these omissions rather than computing AQEF decisions or changing the engine.
The complete gap register is in `docs/STAGE-1-BRIEF.md` and `docs/AMBIGUITIES.md`.

Stage 1 has its ten screen areas implemented within those declared API limits;
external inspection and any future conformance statement remain separate work.

## Verification at UI-6 delivery

The production build passes. Three consecutive complete disposable runs each passed
12 Python integration checks and 45 browser checks. The running Compose build passed
24 additional checks: one sample-adoption workflow, six deployment regressions, nine
Admission/Controls workflows and eight UI-6 decision workflows. These checks use the
unchanged pinned production engine and local simulator, not external test material.
