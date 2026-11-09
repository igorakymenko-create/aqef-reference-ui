# CT-RUI-004 Evidence Record

This document records the visual and behavioural evidence collected for **CT-RUI-004** in
accordance with AQEF CTS Section 26 and Harness Contract §13.

All times, visible text, and comparison results below are quoted verbatim from script
outputs and the `.txt` body-text files saved by the capture script
(`run_ct_rui_004_r2.py` + `finish_ct_rui_004_r2.py`). Nothing has been typed by hand.

---

## Fixture Deviation Note

The specification test references CTS fixture `F-SIGNALS`. Because this UI deployment
does not load CTS fixtures directly, the sample Project `aster-support-decisions`
(Suite `release-readiness`, Environment `local-simulation`) stands in as the test
subject per test instructions.

---

## 1. First Screen (Viewport)

### 1.1 Frozen Report — First Screen

- **Evidence Reference:** `evidence://ct-rui-004-report-first-screen.png`
- **Companion text file:** `evidence://ct-rui-004-report-first-screen.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:24Z", "test": "CT-RUI-004", "action": "Captured Report first screen (viewport)", "observed": "Captured viewport at 2026-11-02T04:57:24Z for http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7", "saved": false, "evidence": ["evidence://ct-rui-004-report-first-screen.png", "evidence://ct-rui-004-report-first-screen.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7`
- **Visible Time (from caption strip):** `2026-11-02T04:57:24Z`
- **Visible text (quoted from `ct-rui-004-report-first-screen.txt`, first lines):**

```
Frozen Report - generated at 2026-11-02T02:39:11.230165+00:00
Gates
Report library
Dashboard

AQEF / POINT-IN-TIME DECISION EVIDENCE

Report

ed14fa35-a0a3-48cf-88fa-052523a456d7

Current state may differ; this Report does not change. Open the Dashboard.
```

### 1.2 Dashboard — First Screen

- **Evidence Reference:** `evidence://ct-rui-004-dashboard-first-screen.png`
- **Companion text file:** `evidence://ct-rui-004-dashboard-first-screen.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:47Z", "test": "CT-RUI-004", "action": "Captured Dashboard first screen (viewport)", "observed": "Captured viewport at 2026-11-02T04:57:47Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-first-screen.png", "evidence://ct-rui-004-dashboard-first-screen.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-02T04:57:47Z`
- **Key visible text (quoted from `ct-rui-004-dashboard-first-screen.txt`):**

```
Live view - updates as new Results arrive
Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:57:47.265Z
Dashboard
Refresh live view
Dashboard Project
Dashboard Suite
Dashboard Environment
Latest returned stored Gate decisions
```

---

## 2. Full Page

### 2.1 Frozen Report — Full Page

- **Evidence Reference:** `evidence://ct-rui-004-report-full-page.png`
- **Companion text file:** `evidence://ct-rui-004-report-full-page.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:24Z", "test": "CT-RUI-004", "action": "Captured Report full page", "observed": "Captured full document at 2026-11-02T04:57:24Z for http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7", "saved": false, "evidence": ["evidence://ct-rui-004-report-full-page.png", "evidence://ct-rui-004-report-full-page.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7`
- **Visible Time (from caption strip):** `2026-11-02T04:57:24Z`
- **Key visible text (quoted from `ct-rui-004-report-full-page.txt`):**
  - Generation banner: `Frozen Report - generated at 2026-11-02T02:39:11.230165+00:00`
  - Subtitle: `AQEF / POINT-IN-TIME DECISION EVIDENCE`
  - Report ID: `ed14fa35-a0a3-48cf-88fa-052523a456d7`
  - Notice: `Current state may differ; this Report does not change. Open the Dashboard.`
  - Project: `aster-support-decisions`, Suite: `release-readiness`, Environment: `local-simulation`
  - Batch ID: `7207fcdd-cb26-4f7c-86a4-2aea1993ac87`
  - Snapshot: `0b2cdfba-a8e2-42b4-a6ef-12822c0e0dc0`
  - Gate: `semantic-readiness`, GateResult `86ecbf50-c394-4f4b-be63-76c14c4e26ef`, `status: fail`

### 2.2 Dashboard — Full Page

- **Evidence Reference:** `evidence://ct-rui-004-dashboard-full-page.png`
- **Companion text file:** `evidence://ct-rui-004-dashboard-full-page.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:48Z", "test": "CT-RUI-004", "action": "Captured Dashboard full page", "observed": "Captured full document at 2026-11-02T04:57:47Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-full-page.png", "evidence://ct-rui-004-dashboard-full-page.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-02T04:57:47Z`
- **Key visible text (quoted from `ct-rui-004-dashboard-full-page.txt`):**
  - Banner: `Live view - updates as new Results arrive`
  - Refresh: `Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:57:47.265Z`
  - Gate section: `Latest returned stored Gate decisions`
  - GateResult IDs: `a50ccb2f-9cb8-4cbd-ab40-cc5d1c6d7e88`, `33985dfb-e3da-4384-b490-ee47028ad62a` (and others visible in full-page screenshot)

---

## 3. Liveness Observations (>= 15 Seconds Apart, No Action Between)

### 3.1 Frozen Report Liveness

- **T0 Capture:**
  - **Evidence Reference:** `evidence://ct-rui-004-report-live-t0.png`
  - **Companion text file:** `evidence://ct-rui-004-report-live-t0.txt`
  - **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:25Z", "test": "CT-RUI-004", "action": "Captured Report live T0 (before 16s wait)", "observed": "Captured viewport at 2026-11-02T04:57:24Z for http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7", "saved": false, "evidence": ["evidence://ct-rui-004-report-live-t0.png", "evidence://ct-rui-004-report-live-t0.txt"]}
```

  - **Visible Time (caption strip):** `2026-11-02T04:57:24Z`

- **T16 Capture (after time.sleep(16), no interaction):**
  - **Evidence Reference:** `evidence://ct-rui-004-report-live-t16.png`
  - **Companion text file:** `evidence://ct-rui-004-report-live-t16.txt`
  - **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:41Z", "test": "CT-RUI-004", "action": "Captured Report live T16 (after 16s wait)", "observed": "Captured viewport at 2026-11-02T04:57:41Z for http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7", "saved": false, "evidence": ["evidence://ct-rui-004-report-live-t16.png", "evidence://ct-rui-004-report-live-t16.txt"]}
```

  - **Visible Time (caption strip):** `2026-11-02T04:57:41Z`

- **Interval:** 2026-11-02T04:57:41Z minus 2026-11-02T04:57:24Z = 17 seconds (from caption strips). Script used time.sleep(16).
- **Script stdout (quoted verbatim):**

```
Report liveness: DOM match=True, Pixel match=True (0 pixels difference below caption strip (identical))
```

- **ct-rui-004-measurements.json, key report_liveness_comparison:**

```json
{"dom_text_identical": true, "pixel_identical_below_caption": true, "pixel_check_details": "0 pixels difference below caption strip (identical)", "interval_seconds": 16}
```

### 3.2 Dashboard Liveness

- **T0 Capture:**
  - **Evidence Reference:** `evidence://ct-rui-004-dashboard-live-t0.png`
  - **Companion text file:** `evidence://ct-rui-004-dashboard-live-t0.txt`
  - **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:57:48Z", "test": "CT-RUI-004", "action": "Captured Dashboard live T0 (before 16s wait)", "observed": "Captured viewport at 2026-11-02T04:57:48Z for http://localhost:3000/#dashboard. Refresh string: Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:57:47.265Z", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-live-t0.png", "evidence://ct-rui-004-dashboard-live-t0.txt"]}
```

  - **Visible Time (caption strip):** `2026-11-02T04:57:48Z`
  - **Refresh string (quoted from ct-rui-004-dashboard-live-t0.txt):**

```
Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:57:47.265Z
```

- **T16 Capture (after time.sleep(16), no interaction):**
  - **Evidence Reference:** `evidence://ct-rui-004-dashboard-live-t16.png`
  - **Companion text file:** `evidence://ct-rui-004-dashboard-live-t16.txt`
  - **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T04:58:04Z", "test": "CT-RUI-004", "action": "Captured Dashboard live T16 (after 16s wait)", "observed": "Captured viewport at 2026-11-02T04:58:04Z for http://localhost:3000/#dashboard. Refresh string: Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:58:02.368Z", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-live-t16.png", "evidence://ct-rui-004-dashboard-live-t16.txt"]}
```

  - **Visible Time (caption strip):** `2026-11-02T04:58:04Z`
  - **Refresh string (quoted from ct-rui-004-dashboard-live-t16.txt):**

```
Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:58:02.368Z
```

- **Interval:** 2026-11-02T04:58:04Z minus 2026-11-02T04:57:48Z = 16 seconds (from caption strips). Script used time.sleep(16).
- **Script stdout (quoted verbatim):**

```
Dashboard liveness: DOM match=False, Pixel match=False (Pixels differ within bounding box (717, 187, 761, 196))
```

- **ct-rui-004-measurements.json, key dashboard_liveness_comparison:**

```json
{"dom_text_identical": false, "pixel_identical_below_caption": false, "pixel_check_details": "Pixels differ within bounding box (717, 187, 761, 196)", "t0_refresh_string": "Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:57:47.265Z", "t16_refresh_string": "Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T04:58:02.368Z", "interval_seconds": 16}
```

- **What changed:** The refresh status line updated autonomously. The timestamp advanced from `2026-11-02T04:57:47.265Z` to `2026-11-02T04:58:02.368Z` (a background polling tick approximately 15 seconds later). No user interaction was performed between the two captures.

---

## 4. Observations After Change to the Suite

A second Suite batch (`fddd448a-8ceb-4a3d-ae45-907f51e88e30`) was executed on
`aster-support-decisions / release-readiness / local-simulation` and its Gates were
evaluated. No new frozen Report was generated for this second batch.

### 4.1 Dashboard After Change

- **Evidence Reference:** `evidence://ct-rui-004-dashboard-after-change.png`
- **Companion text file:** `evidence://ct-rui-004-dashboard-after-change.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T05:15:20Z", "test": "CT-RUI-004", "action": "Captured Dashboard after second suite execution and gate evaluation", "observed": "Captured full document at 2026-11-02T05:15:20Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-after-change.png", "evidence://ct-rui-004-dashboard-after-change.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-02T05:15:20Z`
- **Refresh string (quoted from ct-rui-004-measurements.json, dashboard_after_change):**

```
Automatic refresh every 5 seconds · last successful refresh: 2026-11-02T05:15:19.919Z
```

### 4.2 Earlier Report After Change

- **Evidence Reference:** `evidence://ct-rui-004-report-earlier-after-change.png`
- **Companion text file:** `evidence://ct-rui-004-report-earlier-after-change.txt`
- **actions.jsonl entry (quoted):**

```
{"t": "2026-11-02T05:15:22Z", "test": "CT-RUI-004", "action": "Captured earlier Report after second suite execution and gate evaluation", "observed": "Captured full document at 2026-11-02T05:15:21Z for http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7", "saved": false, "evidence": ["evidence://ct-rui-004-report-earlier-after-change.png", "evidence://ct-rui-004-report-earlier-after-change.txt"]}
```

- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/ed14fa35-a0a3-48cf-88fa-052523a456d7`
- **Visible Time (from caption strip):** `2026-11-02T05:15:21Z`
- **Script stdout (quoted verbatim):**

```
Report after change: DOM match=True, Pixel match=True (0 pixels difference below caption strip (identical))
```

- **ct-rui-004-measurements.json, key report_after_change_comparison:**

```json
{"dom_text_identical": true, "pixel_identical_below_caption": true, "pixel_check_details": "0 pixels difference below caption strip (identical)"}
```

- **What this means:** The Report body text (`document.body.innerText`) and pixel content
  below the caption strip are byte-for-byte identical to those captured in Section 2.1,
  taken before the second batch was executed and its gates evaluated. The generation
  banner (`2026-11-02T02:39:11.230165+00:00`), Report ID
  (`ed14fa35-a0a3-48cf-88fa-052523a456d7`), Batch ID
  (`7207fcdd-cb26-4f7c-86a4-2aea1993ac87`), Snapshot
  (`0b2cdfba-a8e2-42b4-a6ef-12822c0e0dc0`), and all gate results are unchanged.
