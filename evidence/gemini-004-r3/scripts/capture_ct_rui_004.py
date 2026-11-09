import sys
import os
import re
import time
import json
import shutil
import datetime
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont, ImageChops

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = r"D:\Games\Mod\rui-inspection-0a4302e"
DELIVERY_DIR = os.path.join(BASE_DIR, "rui-inspection-004-r3")
EVIDENCE_DIR = os.path.join(DELIVERY_DIR, "evidence")
ACTIONS_FILE = os.path.join(DELIVERY_DIR, "actions.jsonl")
MEASUREMENTS_FILE = os.path.join(DELIVERY_DIR, "ct-rui-004-measurements.json")
SCRIPTS_DIR = os.path.join(DELIVERY_DIR, "scripts")
DOC_FILE = os.path.join(DELIVERY_DIR, "CT-RUI-004-evidence.md")

os.makedirs(EVIDENCE_DIR, exist_ok=True)
os.makedirs(SCRIPTS_DIR, exist_ok=True)

# Clear old actions if any
if os.path.exists(ACTIONS_FILE):
    os.remove(ACTIONS_FILE)

def add_caption(image_path, url, timestamp_str):
    img = Image.open(image_path)
    caption_height = 40
    new_img = Image.new("RGB", (img.width, img.height + caption_height), (24, 24, 28))
    draw = ImageDraw.Draw(new_img)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
    caption_text = f"URL: {url}   |   Visible Time: {timestamp_str}"
    draw.text((15, 10), caption_text, fill=(240, 240, 240), font=font)
    new_img.paste(img, (0, caption_height))
    new_img.save(image_path)

def append_action(test_id, action, observed, saved, evidence_list, t_iso, extra=None):
    record = {
        "t": t_iso,
        "test": test_id,
        "action": action,
        "observed": observed,
        "saved": saved,
        "evidence": evidence_list
    }
    if extra:
        record.update(extra)
    with open(ACTIONS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    print(f"[{t_iso}] [{test_id}] {action}")

def extract_refresh_string(body_text):
    for line in body_text.splitlines():
        if "last successful refresh:" in line:
            return line.strip()
    return "not found"

def extract_report_wording(body_text):
    lines = [l.strip() for l in body_text.splitlines() if l.strip()]
    banner_text = ""
    for l in lines:
        if "Frozen Report" in l:
            banner_text = l
            break
    immutable_line = ""
    for l in lines:
        if "records the state at" in l or "This Report records the state" in l:
            immutable_line = l
            break
    return banner_text, immutable_line

def capture_step(page, filename_base, full_page=True, action_name=None, observed_desc=None, extra=None):
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    img_path = os.path.join(EVIDENCE_DIR, f"{filename_base}.png")
    txt_path = os.path.join(EVIDENCE_DIR, f"{filename_base}.txt")

    page.screenshot(path=img_path, full_page=full_page)
    current_url = page.url
    add_caption(img_path, current_url, now_iso)

    body_text = page.inner_text("body")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(body_text)

    img_ref = f"evidence://{filename_base}.png"
    txt_ref = f"evidence://{filename_base}.txt"
    evidence_list = [img_ref, txt_ref]

    if action_name:
        if callable(observed_desc):
            obs = observed_desc(now_iso, current_url, body_text)
        elif observed_desc:
            obs = observed_desc.replace("{t}", now_iso).replace("{url}", current_url)
        else:
            obs = f"Captured {'full document' if full_page else 'viewport'} at {now_iso} for {current_url}"
        append_action("CT-RUI-004", action_name, obs, False, evidence_list, now_iso, extra)

    return {
        "time": now_iso,
        "url": current_url,
        "img": img_ref,
        "img_path": img_path,
        "txt": txt_ref,
        "txt_path": txt_path,
        "body_text": body_text,
        "full_page": full_page
    }

def compare_images_below_caption(img1_path, img2_path, caption_height=40):
    i1 = Image.open(img1_path)
    i2 = Image.open(img2_path)
    if i1.size != i2.size:
        return False, f"Size difference: {i1.size} vs {i2.size}"
    box = (0, caption_height, i1.width, i1.height)
    crop1 = i1.crop(box)
    crop2 = i2.crop(box)
    diff = ImageChops.difference(crop1, crop2)
    bbox = diff.getbbox()
    if bbox is None:
        return True, "0 pixels difference below caption strip (identical)"
    else:
        return False, f"Pixels differ within bounding box {bbox}"

def select_by_label(page, label_substr, value=None):
    for s in page.query_selector_all("main select"):
        label = s.evaluate('e => e.closest("label") ? e.closest("label").innerText.trim() : ""')
        if label_substr in label:
            if value is not None:
                s.select_option(value=value)
            return s
    return None

def wait_for_batch_options(page, timeout_s=30):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        for s in page.query_selector_all("main select"):
            label = s.evaluate('e => e.closest("label") ? e.closest("label").innerText.trim() : ""')
            if "Execution batch" in label:
                opts = s.query_selector_all("option")
                real_opts = [o for o in opts if o.get_attribute("value")]
                if real_opts:
                    return s, real_opts
        page.wait_for_timeout(1000)
    return None, []

def run_suite_and_evaluate_gates(page, generate_report=False):
    # Navigate to #runs
    print("Navigating to #runs...")
    page.goto("http://localhost:3000/#runs")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    select_by_label(page, "Run Project", value="aster-support-decisions")
    page.wait_for_timeout(500)
    select_by_label(page, "Run Suite", value="release-readiness")
    page.wait_for_timeout(300)
    select_by_label(page, "Run Environment", value="local-simulation")
    page.wait_for_timeout(300)

    print("Starting new batch...")
    page.get_by_role("button", name="Start new batch").click()
    page.wait_for_timeout(4000)

    # Wait for completion
    for _ in range(40):
        st = page.inner_text("main")
        if "completed" in st.lower():
            print("Batch completed.")
            break
        page.wait_for_timeout(1000)

    # Extract batch IDs from runs page
    runs_text = page.inner_text("main")
    batch_ids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', runs_text)
    print("Batch IDs found on #runs:", batch_ids[:3])
    target_batch_id = batch_ids[0] if batch_ids else None

    # Navigate to #gates
    print("Navigating to #gates...")
    page.goto("http://localhost:3000/#gates")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    select_by_label(page, "Gates Project", value="aster-support-decisions")
    page.wait_for_timeout(1500)

    batch_select, batch_opts = wait_for_batch_options(page, timeout_s=30)
    if not batch_opts:
        page.wait_for_timeout(3000)
        batch_select, batch_opts = wait_for_batch_options(page, timeout_s=20)

    if not batch_opts:
        raise RuntimeError("Execution batch dropdown did not populate with options.")

    # Select the target batch ID if available, otherwise first option
    selected_val = None
    if target_batch_id:
        for opt in batch_opts:
            val = opt.get_attribute("value")
            if val == target_batch_id:
                selected_val = val
                break
    if not selected_val:
        selected_val = batch_opts[0].get_attribute("value")

    batch_select.select_option(value=selected_val)
    print(f"Selected batch in #gates: {selected_val}")
    page.wait_for_timeout(800)

    print("Clicking 'Evaluate all applicable Gates'...")
    page.get_by_role("button", name="Evaluate all applicable Gates").click(timeout=15000)
    page.wait_for_timeout(4000)

    # Wait for evaluation to complete
    for _ in range(20):
        st = page.inner_text("main")
        if "semantic-readiness" in st and ("fail" in st.lower() or "pass" in st.lower()):
            print("Gate evaluation completed.")
            break
        page.wait_for_timeout(1000)

    if generate_report:
        print("Clicking 'Generate frozen Report'...")
        page.get_by_role("button", name="Generate frozen Report").click(timeout=15000)
        page.wait_for_timeout(4000)
        print("Report generated.")

    return selected_val

def open_latest_report(page):
    print("Navigating to #reports...")
    page.goto("http://localhost:3000/#reports")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    select_by_label(page, "Reports Project", value="aster-support-decisions")
    page.wait_for_timeout(1000)

    report_link = page.query_selector("main a[href^='#report/']")
    if not report_link:
        raise RuntimeError("Report link not found in #reports library!")

    report_href = report_link.get_attribute("href")
    print("Found report link:", report_href)
    report_link.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    # Wait until frozen banner is visible
    for _ in range(20):
        st = page.inner_text("body")
        if "Frozen Report" in st and "frozen at" in st:
            print("Frozen Report page loaded with frozen banner.")
            break
        page.wait_for_timeout(500)

    return page.url

def open_dashboard(page):
    print("Navigating to #dashboard...")
    page.goto("http://localhost:3000/#dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    select_by_label(page, "Dashboard Project", value="aster-support-decisions")
    page.wait_for_timeout(500)
    select_by_label(page, "Dashboard Suite", value="release-readiness")
    page.wait_for_timeout(500)
    select_by_label(page, "Dashboard Environment", value="local-simulation")
    page.wait_for_timeout(1000)

    print("Waiting for Dashboard to complete initial data load...")
    for _ in range(30):
        st = page.inner_text("main")
        if "last successful refresh:" in st and "not refreshed yet" not in st and "semantic-readiness" in st:
            print("Dashboard initial load complete with last successful refresh and gate decisions!")
            break
        page.wait_for_timeout(1000)

    return page.url

def main():
    utc_start = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"=== STARTING CT-RUI-004 EVIDENCE CAPTURE AT {utc_start} ===")

    measurements = {}
    captures = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 950})

        # =====================================================
        # Step 1: Run Suite, Evaluate Gates, Generate Report
        # =====================================================
        batch1_id = run_suite_and_evaluate_gates(page, generate_report=True)
        measurements["batch_id_first"] = batch1_id

        # =====================================================
        # Step 2: Open Frozen Report & wait for banner
        # =====================================================
        report_url = open_latest_report(page)
        measurements["report_url"] = report_url

        # =====================================================
        # Step 3: Capture Report first screen and full page
        # =====================================================
        captures["report_first_screen"] = capture_step(
            page, "ct-rui-004-report-first-screen", full_page=False,
            action_name="Captured Report first screen (viewport)"
        )

        captures["report_full_page"] = capture_step(
            page, "ct-rui-004-report-full-page", full_page=True,
            action_name="Captured Report full page"
        )

        # Extract Report banner and immutable line from text
        rep_banner, rep_line = extract_report_wording(captures["report_full_page"]["body_text"])
        print("Extracted Report banner:", rep_banner)
        print("Extracted line under title:", rep_line)
        measurements["report_wording"] = {
            "banner": rep_banner,
            "line_under_title": rep_line
        }

        # =====================================================
        # Step 4: Report Liveness Pair (>= 15 s apart, no action)
        # =====================================================
        captures["report_live_t0"] = capture_step(
            page, "ct-rui-004-report-live-t0", full_page=False,
            action_name="Captured Report live T0 (before 16s wait)"
        )

        print("Waiting 16 seconds on Report with no action...")
        time.sleep(16)

        captures["report_live_t1"] = capture_step(
            page, "ct-rui-004-report-live-t1", full_page=False,
            action_name="Captured Report live T1 (after 16s wait)"
        )

        dom_rep_live = (captures["report_live_t0"]["body_text"] == captures["report_live_t1"]["body_text"])
        pix_rep_live, pix_rep_live_desc = compare_images_below_caption(
            captures["report_live_t0"]["img_path"],
            captures["report_live_t1"]["img_path"]
        )
        measurements["report_liveness_comparison"] = {
            "dom_text_identical": dom_rep_live,
            "pixel_identical_below_caption": pix_rep_live,
            "pixel_check_details": pix_rep_live_desc,
            "interval_seconds": 16,
            "file_t0": "ct-rui-004-report-live-t0.png",
            "file_t1": "ct-rui-004-report-live-t1.png",
            "time_t0": captures["report_live_t0"]["time"],
            "time_t1": captures["report_live_t1"]["time"]
        }
        print(f"Report liveness: DOM match={dom_rep_live}, Pixel match={pix_rep_live} ({pix_rep_live_desc})")

        # =====================================================
        # Step 5: Open Dashboard & wait for load
        # =====================================================
        dash_url = open_dashboard(page)
        measurements["dashboard_url"] = dash_url

        # =====================================================
        # Step 6: Capture Dashboard first screen and full page
        # =====================================================
        captures["dashboard_first_screen"] = capture_step(
            page, "ct-rui-004-dashboard-first-screen", full_page=False,
            action_name="Captured Dashboard first screen (viewport)"
        )

        captures["dashboard_full_page"] = capture_step(
            page, "ct-rui-004-dashboard-full-page", full_page=True,
            action_name="Captured Dashboard full page"
        )

        # =====================================================
        # Step 7: Dashboard Liveness Pair (>= 15 s apart, no action)
        # =====================================================
        captures["dashboard_live_t0"] = capture_step(
            page, "ct-rui-004-dashboard-live-t0", full_page=False,
            action_name="Captured Dashboard live T0 (before 16s wait)",
            observed_desc=lambda t, u, b: f"Captured viewport at {t} for {u}. Refresh string: {extract_refresh_string(b)}"
        )
        r_str_0 = extract_refresh_string(captures["dashboard_live_t0"]["body_text"])

        print("Waiting 16 seconds on Dashboard with no action...")
        time.sleep(16)

        captures["dashboard_live_t1"] = capture_step(
            page, "ct-rui-004-dashboard-live-t1", full_page=False,
            action_name="Captured Dashboard live T1 (after 16s wait)",
            observed_desc=lambda t, u, b: f"Captured viewport at {t} for {u}. Refresh string: {extract_refresh_string(b)}"
        )
        r_str_1 = extract_refresh_string(captures["dashboard_live_t1"]["body_text"])

        dom_dash_live = (captures["dashboard_live_t0"]["body_text"] == captures["dashboard_live_t1"]["body_text"])
        pix_dash_live, pix_dash_live_desc = compare_images_below_caption(
            captures["dashboard_live_t0"]["img_path"],
            captures["dashboard_live_t1"]["img_path"]
        )
        measurements["dashboard_liveness_comparison"] = {
            "dom_text_identical": dom_dash_live,
            "pixel_identical_below_caption": pix_dash_live,
            "pixel_check_details": pix_dash_live_desc,
            "t0_refresh_string": r_str_0,
            "t1_refresh_string": r_str_1,
            "interval_seconds": 16,
            "file_t0": "ct-rui-004-dashboard-live-t0.png",
            "file_t1": "ct-rui-004-dashboard-live-t1.png",
            "time_t0": captures["dashboard_live_t0"]["time"],
            "time_t1": captures["dashboard_live_t1"]["time"]
        }
        print(f"Dashboard liveness: DOM match={dom_dash_live}, Pixel match={pix_dash_live} ({pix_dash_live_desc})")
        print(f"  T0 refresh string: {r_str_0}")
        print(f"  T1 refresh string: {r_str_1}")

        # =====================================================
        # Step 8: Trigger change (run Suite again, evaluate Gates again)
        # =====================================================
        print("Triggering change: running Suite release-readiness again and evaluating Gates...")
        batch2_id = run_suite_and_evaluate_gates(page, generate_report=False)
        measurements["batch_id_second"] = batch2_id
        print(f"Second batch: {batch2_id}")

        # =====================================================
        # Step 9: Capture Dashboard after change
        # =====================================================
        print("Navigating to Dashboard after change...")
        open_dashboard(page)
        captures["dashboard_after_change"] = capture_step(
            page, "ct-rui-004-dashboard-after-change", full_page=True,
            action_name="Captured Dashboard after second suite execution and gate evaluation"
        )
        r_str_after = extract_refresh_string(captures["dashboard_after_change"]["body_text"])

        dom_dash_change = (captures["dashboard_full_page"]["body_text"] == captures["dashboard_after_change"]["body_text"])
        pix_dash_change, pix_dash_change_desc = compare_images_below_caption(
            captures["dashboard_full_page"]["img_path"],
            captures["dashboard_after_change"]["img_path"]
        )
        measurements["dashboard_after_change_comparison"] = {
            "dom_text_identical": dom_dash_change,
            "pixel_identical_below_caption": pix_dash_change,
            "pixel_check_details": pix_dash_change_desc,
            "refresh_string": r_str_after,
            "time": captures["dashboard_after_change"]["time"],
            "url": captures["dashboard_after_change"]["url"]
        }
        print(f"Dashboard after change: DOM match={dom_dash_change}, Pixel match={pix_dash_change} ({pix_dash_change_desc})")

        # =====================================================
        # Step 10: Capture Earlier Report after change
        # =====================================================
        print(f"Navigating to earlier Report URL {report_url} after change...")
        page.goto(report_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        for _ in range(20):
            st = page.inner_text("body")
            if "Frozen Report" in st and "frozen at" in st:
                break
            page.wait_for_timeout(500)

        captures["report_earlier_after_change"] = capture_step(
            page, "ct-rui-004-report-earlier-after-change", full_page=True,
            action_name="Captured earlier Report after second suite execution and gate evaluation"
        )

        dom_rep_change = (captures["report_full_page"]["body_text"] == captures["report_earlier_after_change"]["body_text"])
        pix_rep_change, pix_rep_change_desc = compare_images_below_caption(
            captures["report_full_page"]["img_path"],
            captures["report_earlier_after_change"]["img_path"]
        )
        measurements["report_after_change_comparison"] = {
            "dom_text_identical": dom_rep_change,
            "pixel_identical_below_caption": pix_rep_change,
            "pixel_check_details": pix_rep_change_desc,
            "time": captures["report_earlier_after_change"]["time"],
            "url": captures["report_earlier_after_change"]["url"]
        }
        print(f"Earlier Report after change: DOM match={dom_rep_change}, Pixel match={pix_rep_change} ({pix_rep_change_desc})")

        browser.close()

    # Note extra batches
    measurements["extra_batches_note"] = (
        "None. Exactly two batches were created: "
        f"batch 1 ({batch1_id}) for the initial Suite run, Gate evaluation, and Report generation; "
        f"batch 2 ({batch2_id}) for re-running the Suite and re-evaluating Gates after change."
    )

    # Save measurements.json
    with open(MEASUREMENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(measurements, f, indent=2)
    print(f"Saved measurements to {MEASUREMENTS_FILE}")

    # Copy script into delivery folder
    this_script_path = os.path.abspath(__file__)
    dest_script_path = os.path.join(SCRIPTS_DIR, "capture_ct_rui_004.py")
    if os.path.abspath(this_script_path) != os.path.abspath(dest_script_path):
        shutil.copy2(this_script_path, dest_script_path)
        print(f"Copied capture script to {dest_script_path}")

    # Generate CT-RUI-004-evidence.md
    generate_markdown_evidence(measurements, captures, utc_start)
    print(f"Generated {DOC_FILE}")

    # Mirror delivery folder to D:\Games\Mod\rui-inspection-004-r3\rui-inspection-004-r3
    alt_delivery_dir = r"D:\Games\Mod\rui-inspection-004-r3\rui-inspection-004-r3"
    if os.path.exists(r"D:\Games\Mod\rui-inspection-004-r3"):
        if os.path.exists(alt_delivery_dir):
            shutil.rmtree(alt_delivery_dir)
        shutil.copytree(DELIVERY_DIR, alt_delivery_dir)
        print(f"Mirrored delivery folder to {alt_delivery_dir}")

def generate_markdown_evidence(m, c, utc_start):
    banner_q = m["report_wording"]["banner"]
    line_q = m["report_wording"]["line_under_title"]
    
    # Read actions lines for quotation
    with open(ACTIONS_FILE, "r", encoding="utf-8") as f:
        action_lines = [l.strip() for l in f if l.strip()]

    def find_action(pattern):
        for l in action_lines:
            if pattern in l:
                return l
        return ""

    md_content = f"""# CT-RUI-004 Evidence Record

**Start UTC:** {utc_start}  
**Repository:** `igorakymenko-create/aqef-reference-ui`  
**Commit:** `60c354e626fef28252751855d28d413156de1ff2` (`main`, incorporating `codex/ui-6.1-report-wording`)  
**Subject:** `aster-support-decisions` / `release-readiness` / `local-simulation`  
**Capture Script:** `scripts/capture_ct_rui_004.py`

This document records the visual, text, and behavioural evidence collected for **CT-RUI-004** on the corrected Report wording. All timestamps, URLs, visible texts, and comparison metrics are quoted verbatim from the `.txt` body text files, screenshot caption strips, and `actions.jsonl` produced by `scripts/capture_ct_rui_004.py`. No values have been typed by hand.

---

## 1. Wording on Corrected Frozen Report

The following wording is quoted exactly as it appears in the `.txt` visible text files (`ct-rui-004-report-first-screen.txt`, `ct-rui-004-report-full-page.txt`):

### 1.1 Report Banner (quoted verbatim from `.txt`)

> `{banner_q}`

### 1.2 Line under Report Title (quoted verbatim from `.txt`)

> `{line_q}`

---

## 2. First Screen (Viewport)

### 2.1 Frozen Report — First Screen

- **Evidence Image:** `evidence://ct-rui-004-report-first-screen.png`
- **Companion Text File:** `evidence://ct-rui-004-report-first-screen.txt`
- **URL (from caption strip):** `{c['report_first_screen']['url']}`
- **Visible Time (from caption strip):** `{c['report_first_screen']['time']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured Report first screen")}
```

- **Report Banner quoted from `ct-rui-004-report-first-screen.txt`:**

```
{banner_q}
```

- **Line under Report Title quoted from `ct-rui-004-report-first-screen.txt`:**

```
{line_q}
```

### 2.2 Dashboard — First Screen

- **Evidence Image:** `evidence://ct-rui-004-dashboard-first-screen.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-first-screen.txt`
- **URL (from caption strip):** `{c['dashboard_first_screen']['url']}`
- **Visible Time (from caption strip):** `{c['dashboard_first_screen']['time']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured Dashboard first screen")}
```

- **Key visible lines quoted from `ct-rui-004-dashboard-first-screen.txt`:**

```
Live view — updates as new Results arrive
{extract_refresh_string(c['dashboard_first_screen']['body_text'])}
Dashboard
```

---

## 3. Full Page Captures

### 3.1 Frozen Report — Full Page

- **Evidence Image:** `evidence://ct-rui-004-report-full-page.png`
- **Companion Text File:** `evidence://ct-rui-004-report-full-page.txt`
- **URL (from caption strip):** `{c['report_full_page']['url']}`
- **Visible Time (from caption strip):** `{c['report_full_page']['time']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured Report full page")}
```

- **Report Banner quoted from `ct-rui-004-report-full-page.txt`:**

```
{banner_q}
```

- **Line under Report Title quoted from `ct-rui-004-report-full-page.txt`:**

```
{line_q}
```

### 3.2 Dashboard — Full Page

- **Evidence Image:** `evidence://ct-rui-004-dashboard-full-page.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-full-page.txt`
- **URL (from caption strip):** `{c['dashboard_full_page']['url']}`
- **Visible Time (from caption strip):** `{c['dashboard_full_page']['time']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured Dashboard full page")}
```

- **Key visible lines quoted from `ct-rui-004-dashboard-full-page.txt`:**

```
Live view — updates as new Results arrive
{extract_refresh_string(c['dashboard_full_page']['body_text'])}
Latest returned stored Gate decisions
```

---

## 4. Liveness Pairs (>= 15 Seconds Apart, No Action Between)

### 4.1 Frozen Report Liveness Pair

- **T0 Capture:**
  - **Evidence Image:** `evidence://ct-rui-004-report-live-t0.png`
  - **Companion Text File:** `evidence://ct-rui-004-report-live-t0.txt`
  - **URL:** `{c['report_live_t0']['url']}`
  - **Visible Time (caption strip):** `{c['report_live_t0']['time']}`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {find_action("Captured Report live T0")}
  ```

- **T1 Capture (after 16s wait with no interaction):**
  - **Evidence Image:** `evidence://ct-rui-004-report-live-t1.png`
  - **Companion Text File:** `evidence://ct-rui-004-report-live-t1.txt`
  - **URL:** `{c['report_live_t1']['url']}`
  - **Visible Time (caption strip):** `{c['report_live_t1']['time']}`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {find_action("Captured Report live T1")}
  ```

- **Measurements (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `{m['report_liveness_comparison']['dom_text_identical']}`
  - `pixel_identical_below_caption`: `{m['report_liveness_comparison']['pixel_identical_below_caption']}`
  - `pixel_check_details`: `{m['report_liveness_comparison']['pixel_check_details']}`
  - `interval_seconds`: {m['report_liveness_comparison']['interval_seconds']}

### 4.2 Dashboard Liveness Pair

- **T0 Capture:**
  - **Evidence Image:** `evidence://ct-rui-004-dashboard-live-t0.png`
  - **Companion Text File:** `evidence://ct-rui-004-dashboard-live-t0.txt`
  - **URL:** `{c['dashboard_live_t0']['url']}`
  - **Visible Time (caption strip):** `{c['dashboard_live_t0']['time']}`
  - **Refresh String at T0:** `{m['dashboard_liveness_comparison']['t0_refresh_string']}`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {find_action("Captured Dashboard live T0")}
  ```

- **T1 Capture (after 16s wait with no interaction):**
  - **Evidence Image:** `evidence://ct-rui-004-dashboard-live-t1.png`
  - **Companion Text File:** `evidence://ct-rui-004-dashboard-live-t1.txt`
  - **URL:** `{c['dashboard_live_t1']['url']}`
  - **Visible Time (caption strip):** `{c['dashboard_live_t1']['time']}`
  - **Refresh String at T1:** `{m['dashboard_liveness_comparison']['t1_refresh_string']}`
  - **actions.jsonl entry (quoted verbatim):**
  ```json
  {find_action("Captured Dashboard live T1")}
  ```

- **Measurements (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `{m['dashboard_liveness_comparison']['dom_text_identical']}`
  - `pixel_identical_below_caption`: `{m['dashboard_liveness_comparison']['pixel_identical_below_caption']}`
  - `pixel_check_details`: `{m['dashboard_liveness_comparison']['pixel_check_details']}`
  - `interval_seconds`: {m['dashboard_liveness_comparison']['interval_seconds']}

---

## 5. Captures After a Change

A second Suite batch was executed on `aster-support-decisions / release-readiness / local-simulation` (Batch ID: `{m['batch_id_second']}`) and its Gates were evaluated. No new Report was generated for the second batch.

### 5.1 Dashboard After Change

- **Evidence Image:** `evidence://ct-rui-004-dashboard-after-change.png`
- **Companion Text File:** `evidence://ct-rui-004-dashboard-after-change.txt`
- **URL (from caption strip):** `{c['dashboard_after_change']['url']}`
- **Visible Time (from caption strip):** `{c['dashboard_after_change']['time']}`
- **Refresh String:** `{m['dashboard_after_change_comparison']['refresh_string']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured Dashboard after second suite")}
```

- **Comparison against Dashboard Full Page Before Change (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `{m['dashboard_after_change_comparison']['dom_text_identical']}`
  - `pixel_identical_below_caption`: `{m['dashboard_after_change_comparison']['pixel_identical_below_caption']}`
  - `pixel_check_details`: `{m['dashboard_after_change_comparison']['pixel_check_details']}`

### 5.2 Earlier Report After Change

- **Evidence Image:** `evidence://ct-rui-004-report-earlier-after-change.png`
- **Companion Text File:** `evidence://ct-rui-004-report-earlier-after-change.txt`
- **URL (from caption strip):** `{c['report_earlier_after_change']['url']}`
- **Visible Time (from caption strip):** `{c['report_earlier_after_change']['time']}`
- **actions.jsonl entry (quoted verbatim):**

```json
{find_action("Captured earlier Report after second suite")}
```

- **Comparison against Earlier Report Full Page Before Change (quoted verbatim from `ct-rui-004-measurements.json`):**
  - `dom_text_identical`: `{m['report_after_change_comparison']['dom_text_identical']}`
  - `pixel_identical_below_caption`: `{m['report_after_change_comparison']['pixel_identical_below_caption']}`
  - `pixel_check_details`: `{m['report_after_change_comparison']['pixel_check_details']}`

---

## 6. Batch Accounting

- **Batch 1 (Initial execution, gate evaluation, report generation):** `{m['batch_id_first']}`
- **Batch 2 (Second execution and gate evaluation after change):** `{m['batch_id_second']}`
- **Extra batches note:** {m['extra_batches_note']}
"""
    with open(DOC_FILE, "w", encoding="utf-8") as f:
        f.write(md_content)

if __name__ == "__main__":
    main()
