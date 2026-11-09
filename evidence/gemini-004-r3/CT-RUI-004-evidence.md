# CT-RUI-004 Evidence Record

**Start UTC:** 2026-11-08T23:09:13Z  
**Repository:** `igorakymenko-create/aqef-reference-ui`  
**Commit:** `60c354e626fef28252751855d28d413156de1ff2` (`main`, incorporating `codex/ui-6.1-report-wording`)  
**Subject:** `aster-support-decisions` / `release-readiness` / `local-simulation`  
**Capture Script:** `scripts/capture_ct_rui_004.py`

This document records the visual, text, and behavioural evidence collected for **CT-RUI-004** on the corrected Report wording. All timestamps, URLs, visible texts, and comparison metrics are quoted verbatim from the `.txt` body text files, screenshot caption strips, and `actions.jsonl` produced by `scripts/capture_ct_rui_004.py`. No values have been typed by hand.

---

## 1. Wording on Corrected Frozen Report

The following wording is quoted exactly as it appears in the `.txt` visible text files (`ct-rui-004-report-first-screen.txt`, `ct-rui-004-report-full-page.txt`):

### 1.1 Report Banner (quoted verbatim from `.txt`)

> `Frozen Report — frozen at 2026-11-08T23:09:28.000230+00:00. Nothing on this page changes after that moment.`

### 1.2 Line under Report Title (quoted verbatim from `.txt`)

> `This Report records the state at 2026-11-08T23:09:28.000230+00:00. Results, reviews or overrides recorded after that moment are not in it. For the current state, open the live Dashboard.`

---

## 2. First Screen (Viewport)

### 2.1 Frozen Report — First Screen

- **Evidence Image:** `evidence://ct-rui-004-report-first-screen.png`
- **Companion Text File:** `evidence://ct-rui-004-report-first-screen.txt`
- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7`
- **Visible Time (from caption strip):** `2026-11-08T23:09:34Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:09:34Z", "test": "CT-RUI-004", "action": "Captured Report first screen (viewport)", "observed": "Captured viewport at 2026-11-08T23:09:34Z for http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7", "saved": false, "evidence": ["evidence://ct-rui-004-report-first-screen.png", "evidence://ct-rui-004-report-first-screen.txt"]}
```

- **Report Banner quoted from `ct-rui-004-report-first-screen.txt`:**

```
Frozen Report — frozen at 2026-11-08T23:09:28.000230+00:00. Nothing on this page changes after that moment.
```

- **Line under Report Title quoted from `ct-rui-004-report-first-screen.txt`:**

```
This Report records the state at 2026-11-08T23:09:28.000230+00:00. Results, reviews or overrides recorded after that moment are not in it. For the current state, open the live Dashboard.
```

### 2.2 Dashboard — First Screen

- **Evidence Image:** `evidence://ct-rui-004-dashboard-first-screen.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-first-screen.txt`
- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-08T23:09:53Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:09:53Z", "test": "CT-RUI-004", "action": "Captured Dashboard first screen (viewport)", "observed": "Captured viewport at 2026-11-08T23:09:53Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-first-screen.png", "evidence://ct-rui-004-dashboard-first-screen.txt"]}
```

- **Key visible lines quoted from `ct-rui-004-dashboard-first-screen.txt`:**

```
Live view — updates as new Results arrive
Automatic refresh every 5 seconds · last successful refresh: 2026-11-08T23:09:53.426Z
Dashboard
```

---

## 3. Full Page Captures

### 3.1 Frozen Report — Full Page

- **Evidence Image:** `evidence://ct-rui-004-report-full-page.png`
- **Companion Text File:** `evidence://ct-rui-004-report-full-page.txt`
- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7`
- **Visible Time (from caption strip):** `2026-11-08T23:09:34Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:09:34Z", "test": "CT-RUI-004", "action": "Captured Report full page", "observed": "Captured full document at 2026-11-08T23:09:34Z for http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7", "saved": false, "evidence": ["evidence://ct-rui-004-report-full-page.png", "evidence://ct-rui-004-report-full-page.txt"]}
```

- **Report Banner quoted from `ct-rui-004-report-full-page.txt`:**

```
Frozen Report — frozen at 2026-11-08T23:09:28.000230+00:00. Nothing on this page changes after that moment.
```

- **Line under Report Title quoted from `ct-rui-004-report-full-page.txt`:**

```
This Report records the state at 2026-11-08T23:09:28.000230+00:00. Results, reviews or overrides recorded after that moment are not in it. For the current state, open the live Dashboard.
```

### 3.2 Dashboard — Full Page

- **Evidence Image:** `evidence://ct-rui-004-dashboard-full-page.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-full-page.txt`
- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-08T23:09:53Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:09:53Z", "test": "CT-RUI-004", "action": "Captured Dashboard full page", "observed": "Captured full document at 2026-11-08T23:09:53Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-full-page.png", "evidence://ct-rui-004-dashboard-full-page.txt"]}
```

- **Key visible lines quoted from `ct-rui-004-dashboard-full-page.txt`:**

```
Live view — updates as new Results arrive
Automatic refresh every 5 seconds · last successful refresh: 2026-11-08T23:09:53.426Z
Latest returned stored Gate decisions
```

---

## 4. Liveness Pairs (>= 15 Seconds Apart, No Action Between)

### 4.1 Frozen Report Liveness Pair

- **T0 Capture:**
  - **Evidence Image:** `evidence://ct-rui-004-report-live-t0.png`
  - **Companion Text File:** `evidence://ct-rui-004-report-live-t0.txt`
  - **URL:** `http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7`
  - **Visible Time (caption strip):** `2026-11-08T23:09:35Z`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {"t": "2026-11-08T23:09:35Z", "test": "CT-RUI-004", "action": "Captured Report live T0 (before 16s wait)", "observed": "Captured viewport at 2026-11-08T23:09:35Z for http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7", "saved": false, "evidence": ["evidence://ct-rui-004-report-live-t0.png", "evidence://ct-rui-004-report-live-t0.txt"]}
  ```

- **T1 Capture (after 16s wait with no interaction):**
  - **Evidence Image:** `evidence://ct-rui-004-report-live-t1.png`
  - **Companion Text File:** `evidence://ct-rui-004-report-live-t1.txt`
  - **URL:** `http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7`
  - **Visible Time (caption strip):** `2026-11-08T23:09:51Z`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {"t": "2026-11-08T23:09:51Z", "test": "CT-RUI-004", "action": "Captured Report live T1 (after 16s wait)", "observed": "Captured viewport at 2026-11-08T23:09:51Z for http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7", "saved": false, "evidence": ["evidence://ct-rui-004-report-live-t1.png", "evidence://ct-rui-004-report-live-t1.txt"]}
  ```

- **Measurements (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `True`
  - `pixel_identical_below_caption`: `True`
  - `pixel_check_details`: `0 pixels difference below caption strip (identical)`
  - `interval_seconds`: 16

### 4.2 Dashboard Liveness Pair

- **T0 Capture:**
  - **Evidence Image:** `evidence://ct-rui-004-dashboard-live-t0.png`
  - **Companion Text File:** `evidence://ct-rui-004-dashboard-live-t0.txt`
  - **URL:** `http://localhost:3000/#dashboard`
  - **Visible Time (caption strip):** `2026-11-08T23:09:54Z`
  - **Refresh String at T0:** `Automatic refresh every 5 seconds · last successful refresh: 2026-11-08T23:09:53.426Z`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {"t": "2026-11-08T23:09:54Z", "test": "CT-RUI-004", "action": "Captured Dashboard live T0 (before 16s wait)", "observed": "Captured viewport at 2026-11-08T23:09:54Z for http://localhost:3000/#dashboard. Refresh string: Automatic refresh every 5 seconds \u00b7 last successful refresh: 2026-11-08T23:09:53.426Z", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-live-t0.png", "evidence://ct-rui-004-dashboard-live-t0.txt"]}
  ```

- **T1 Capture (after 16s wait with no interaction):**
  - **Evidence Image:** `evidence://ct-rui-004-dashboard-live-t1.png`
  - **Companion Text File:** `evidence://ct-rui-004-dashboard-live-t1.txt`
  - **URL:** `http://localhost:3000/#dashboard`
  - **Visible Time (caption strip):** `2026-11-08T23:10:10Z`
  - **Refresh String at T1:** `Automatic refresh every 5 seconds · last successful refresh: 2026-11-08T23:10:08.361Z`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {"t": "2026-11-08T23:10:10Z", "test": "CT-RUI-004", "action": "Captured Dashboard live T1 (after 16s wait)", "observed": "Captured viewport at 2026-11-08T23:10:10Z for http://localhost:3000/#dashboard. Refresh string: Automatic refresh every 5 seconds \u00b7 last successful refresh: 2026-11-08T23:10:08.361Z", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-live-t1.png", "evidence://ct-rui-004-dashboard-live-t1.txt"]}
  ```

- **Measurements (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `False`
  - `pixel_identical_below_caption`: `False`
  - `pixel_check_details`: `Pixels differ within bounding box (710, 187, 761, 196)`
  - `interval_seconds`: 16

---

## 5. Captures After a Change

A second Suite batch was executed on `aster-support-decisions / release-readiness / local-simulation` (Batch ID: `0e257acf-7d0a-4adb-ab04-16906995cb7a`) and its Gates were evaluated. No new Report was generated for the second batch.

### 5.1 Dashboard After Change

- **Evidence Image:** `evidence://ct-rui-004-dashboard-after-change.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-after-change.txt`
- **URL (from caption strip):** `http://localhost:3000/#dashboard`
- **Visible Time (from caption strip):** `2026-11-08T23:10:27Z`
- **Refresh String:** `Automatic refresh every 5 seconds · last successful refresh: 2026-11-08T23:10:26.417Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:10:27Z", "test": "CT-RUI-004", "action": "Captured Dashboard after second suite execution and gate evaluation", "observed": "Captured full document at 2026-11-08T23:10:27Z for http://localhost:3000/#dashboard", "saved": false, "evidence": ["evidence://ct-rui-004-dashboard-after-change.png", "evidence://ct-rui-004-dashboard-after-change.txt"]}
```

- **Comparison against Dashboard Full Page Before Change (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `False`
  - `pixel_identical_below_caption`: `False`
  - `pixel_check_details`: `Size difference: (1400, 9880) vs (1400, 9951)`

### 5.2 Earlier Report After Change

- **Evidence Image:** `evidence://ct-rui-004-report-earlier-after-change.png`
- **Companion Text File:** `evidence://ct-rui-004-report-earlier-after-change.txt`
- **URL (from caption strip):** `http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7`
- **Visible Time (from caption strip):** `2026-11-08T23:10:28Z`
- **actions.jsonl entry (quoted verbatim):**

```json
{"t": "2026-11-08T23:10:28Z", "test": "CT-RUI-004", "action": "Captured earlier Report after second suite execution and gate evaluation", "observed": "Captured full document at 2026-11-08T23:10:28Z for http://localhost:3000/#report/aster-support-decisions/e6b5a2fc-e5df-47d4-9ed5-1f22b7fe1bd7", "saved": false, "evidence": ["evidence://ct-rui-004-report-earlier-after-change.png", "evidence://ct-rui-004-report-earlier-after-change.txt"]}
```

- **Comparison against Earlier Report Full Page Before Change (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `True`
  - `pixel_identical_below_caption`: `True`
  - `pixel_check_details`: `0 pixels difference below caption strip (identical)`

---

## 6. Batch Accounting

- **Batch 1 (Initial execution, gate evaluation, report generation):** `c1a37737-e5e1-4268-baa9-3cf772c8cfe0`
- **Batch 2 (Second execution and gate evaluation after change):** `0e257acf-7d0a-4adb-ab04-16906995cb7a`
- **Extra batches note:** None. Exactly two batches were created: batch 1 (c1a37737-e5e1-4268-baa9-3cf772c8cfe0) for the initial Suite run, Gate evaluation, and Report generation; batch 2 (0e257acf-7d0a-4adb-ab04-16906995cb7a) for re-running the Suite and re-evaluating Gates after change.
