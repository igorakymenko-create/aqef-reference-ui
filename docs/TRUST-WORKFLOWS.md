# Admission and Seeded Controls (UI-5)

Evidence pages now put Conversation, Artifacts and readable Results/chains first.
Frozen configuration is last and collapsed with its frozen-at-execution label visible.
Every Result retains clause/Oracle, disposition/verdict, Confidence, criteria,
explanation, recorded time and chain position. Exact Oracle/provider/attempts/full
Result are under Show engine record. Panel members are a table with individual
disclosures; configured/counted figures come directly from the engine.

## Admission

1. Choose the exact Judge configuration and Reference Set version. Panels are admitted
   member by member. Exposure filtering shows the count, excluded IDs and snapshot.
   The illustrative single-labeller sample carries a SHOULD note, not an automatic claim
   of independent blind review. A new model, criteria or confidence_source needs a new
   workflow and exact-Oracle Admission; old records remain visible for their own identity.
2. Declare Cohen's κ and a finite threshold before scoring. Record declaration time,
   Person and snapshot in admissions/plans/<uuid>.yaml. This auxiliary file is workflow
   evidence, never a Project DTO sent to the engine. Resume it after navigation/reload.
3. Choose an Environment, generate the fixed-Evidence Suite, and use Workspace's normal
   diff/Review & Apply/Confirm Apply. Return and resume the declaration, then run. The
   pin permits fixed Evidence only as construction controls, so this diagnostic Project
   is separate from product controls, one class per item. Threshold 0 is explicitly
   authored in diagnostic Judge clauses to collect verdicts and does not change the
   exact Oracle identity. No subject is called. Live applied Evidence must match the plan.
4. Compute/show the 2×2 table and each substituted formula: Pₒ=(a+d)/N,
   Pₑ=((a+b)(a+c)+(c+d)(b+d))/N², κ=(Pₒ−Pₑ)/(1−Pₑ). Human labels define the
   submitted verdict_distribution. Raw verdicts are measured, not reclassified by the UI.
   One-class/undefined measures are not_computed and propose admitted false. Unscored
   items remain visible; the required numeric raw_agreement cannot be fabricated, so
   that incomplete measurement cannot be submitted.
5. Record through POST /admissions with only documented fields. The proposed admitted
   value is exactly κ≥threshold (false for not_computed); engine acceptance is final.
   Arbitrations are optional entered reason/reference lines. Records stay in acceptance
   order, and the last for each exact Oracle says decides current status. A later
   accepted admitted false record withdraws that earlier status.

Changing the threshold after scoring remains allowed. The screen immediately shows
threshold changed after results were seen; saving/recording writes that fact, the
changed threshold and Person/time history into the plan without erasing the original
declaration. Editing a plan changed on disk requires resuming its current revision.

## Seeded Controls

Control Scenario Designer edits the same Project YAML and shared Apply route. Choose
kind, class, planted defect where required, confirmation method, Evidence binding and
Contract explicitly. The Suite execution policy is optional and its inherited/global
skip_class default is described without materializing it. Source Execution loading copies
recorded fixed Evidence/provenance; duplicate Artifact names are refused instead of lost.
The pinned schema limits fixed Evidence to construction; Human/Validator confirmation
uses captured subject Evidence. Unsupported combinations retain the engine rejection.

Seeded Controls lists batch records apart from product Results: kind/class, recorded
outcome, per-Oracle detail, confirmation and tested Result IDs. invalid is labelled
Evidence not confirmed — no verdict about the Oracle. Only returned invalidated_by
adds an invalidated label to a product Result; links run both ways to the control/class.
Original verdicts are retained. Controls never enter quality aggregates.

Eligible Persons can record Human confirmation with an explicit true/false choice and
reason. The pin refuses false; no local confirmation/outcome is invented. A missed or
false-alarm control can explicitly invalidate the full run with a reason; every Result
then becomes blocked. Requalification takes an exact Oracle from a caught/passed control
Result, class, selected Result IDs and diagnosis. The engine refuses reused/exposed or
out-of-time controls. After accepted records cover returned classes, Execution pages
offer corrected re-assessment; the engine checks complete control kinds and frozen
compatibility and appends a resolving Result. The subject is not called. No Gate or
Report is calculated or refreshed by these workflows.
