import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { linePath } from "../src/decisions/Trend";
import { LIVE_INTERVAL } from "../src/decisions/api";

const project = "ui6-check-" + crypto.randomUUID(),
  root = "/api/projects/" + project,
  sourcePath = "checks/" + project + ".yaml";
const definition = parse(
  readFileSync("examples/aster/decision-project.yaml", "utf8"),
);
definition.project.name = project;
let batch: any,
  first: any,
  second: any,
  third: any,
  oldReport: any,
  newReport: any,
  release: any;
const gatePage = (batchId: string) => "/#gates/" + project + "/" + batchId;
async function applySource(
  page: Page,
  content: string,
  expectedDiff = project,
) {
  await page.goto("/#workspace");
  await expect(page.getByTestId("yaml-editor")).toBeVisible();
  await page.evaluate(
    ({ path, content }) =>
      window.dispatchEvent(
        new CustomEvent("aqef-propose-source", { detail: { path, content } }),
      ),
    { path: sourcePath, content },
  );
  await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
    expectedDiff,
  );
  await page
    .getByRole("button", { name: "Review & Apply", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Apply preview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm Apply", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Apply (complete|no changes)/ }),
  ).toBeVisible();
}
async function evaluate(page: Page) {
  const received = page.waitForResponse(
    (r) =>
      r.url().endsWith(root + "/gates/check") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Evaluate all applicable Gates", exact: true })
    .click();
  const response = await received;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({
    execution_batch_id: batch.execution_batch_id,
  });
  const data = await response.json();
  await expect(
    page.getByRole("region", { name: "Gate decisions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Evaluation history" }),
  ).toContainText(data.snapshot_id);
  return data;
}
async function generate(page: Page) {
  const received = page.waitForResponse(
    (r) =>
      r.url().endsWith(root + "/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Generate frozen Report", exact: true })
    .click();
  const response = await received;
  expect(response.status()).toBe(201);
  const data = await response.json();
  await expect(page.getByTestId("frozen-marker")).toContainText(
    data.generated_at,
  );
  return data;
}
async function recordOverride(page: Page, gate: string, reason: string) {
  await page
    .getByRole("button", { name: "Override " + gate, exact: true })
    .click();
  const form = page.getByRole("region", { name: "Override form" });
  await expect(form).toContainText(
    "This override covers this GateResult only. A new evaluation will not inherit it.",
  );
  await page.getByLabel("Override justification", { exact: true }).fill(reason);
}
async function sourceResults(page: Page) {
  const rows = [];
  for (const execution of batch.executions) {
    const data = await (
      await page.request.get(
        `${root}/executions/${execution.id}/results?limit=1000`,
      )
    ).json();
    rows.push(...data);
  }
  return rows;
}
function exactReasons(page: Page, name: string, codes: string[]) {
  return expect(
    page
      .getByRole("article", { name: "Gate " + name, exact: true })
      .locator("[data-reason]"),
  ).toHaveText(codes.map((code) => new RegExp(code)));
}
function gate(page: Page, name: string) {
  return page.getByRole("article", { name: "Gate " + name, exact: true });
}

test.describe
  .serial("UI-6 independent Gates, Reports and decision checks", () => {
  test.setTimeout(90000);
  test("one real batch shows every engine reason, Basis, not_computed and advisory without a headline score", async ({
    page,
  }) => {
    await applySource(page, stringify(definition));
    const response = await page.request.post(root + "/executions", {
      data: { suite: "release-readiness", environment: "local-simulation" },
    });
    expect(response.status()).toBe(201);
    batch = await response.json();
    expect(batch.executions).toHaveLength(10);
    await page.goto(gatePage(batch.execution_batch_id));
    first = await evaluate(page);
    expect(Object.keys(first.gates).sort()).toEqual([
      "admitted-instruments",
      "latency-advisory",
      "minimum-safety-basis",
      "response-shape",
      "semantic-readiness",
    ]);
    expect(first.gates["semantic-readiness"].reasons).toEqual([
      "non_actionable_results",
      "seeded_control_false_alarm",
      "seeded_control_miss",
      "threshold",
    ]);
    for (const [name, result] of Object.entries(first.gates) as [
      string,
      any,
    ][]) {
      const card = gate(page, name);
      await expect(card).toContainText(result.id);
      await expect(card.locator("[data-reason]")).toHaveCount(
        result.reasons?.length ?? 0,
      );
      if (result.reasons) await exactReasons(page, name, result.reasons);
      for (const key of [
        "results",
        "not_actionable",
        "scenarios",
        "executions",
        "min_basis_met",
      ])
        await expect(card.getByLabel("Aggregate Basis").first()).toContainText(
          key,
        );
    }
    await expect(gate(page, "semantic-readiness")).toContainText(
      "Failed its threshold.",
    );
    expect(first.gates["minimum-safety-basis"].value).toBe("not_computed");
    await expect(
      gate(page, "minimum-safety-basis").getByLabel("Recorded value"),
    ).toHaveText(/Value\s*not_computed/);
    await expect(gate(page, "minimum-safety-basis")).toContainText(
      "Fell short of its declared minimum Basis.",
    );
    await expect(gate(page, "latency-advisory")).toContainText("Advisory");
    await expect(
      gate(page, "latency-advisory").locator(".scope-label"),
    ).not.toHaveText("Blocking");
    await expect(
      gate(page, "latency-advisory").getByLabel("Per-metric Basis"),
    ).toContainText("latency_ms");
    await expect(gate(page, "response-shape")).toContainText("status: pass");
    await expect(
      page.getByRole("heading", {
        name: /headline score|quality score|run score/i,
      }),
    ).toHaveCount(0);
    await page.screenshot({ path: ".local/ui6-gates-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({ path: ".local/ui6-gates-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    oldReport = await generate(page);
    expect(oldReport.snapshot_id).toBe(first.snapshot_id);
    await expect(page.getByRole("region", { name: /Signal / })).toHaveCount(6);
    await page.screenshot({ path: ".local/ui6-report.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.evaluate(() => scrollTo(0, 600));
    await expect(page.getByTestId("frozen-marker")).toBeInViewport();
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: ".local/ui6-report-mobile.png" });
  });
  test("a newer evaluation preserves history and numbers open only engine-listed Result IDs grouped by clause", async ({
    page,
  }) => {
    await page.goto(gatePage(batch.execution_batch_id));
    second = await evaluate(page);
    expect(second.snapshot_id).not.toBe(first.snapshot_id);
    await expect(
      page.getByRole("region", { name: "Evaluation history" }),
    ).toContainText(first.snapshot_id);
    const id = second.result_ids[0];
    await gate(page, "semantic-readiness")
      .getByRole("button", {
        name: "Open this evaluation's Result IDs and Evidence →",
        exact: true,
      })
      .click();
    const evidence = page.getByRole("region", { name: "Evaluation Results" });
    await expect(evidence.locator(".result-entry")).toHaveCount(
      second.result_ids.length,
    );
    const buttons = await evidence
      .getByRole("button", { name: /^Evidence for/ })
      .evaluateAll((nodes) =>
        nodes.map((n) =>
          n.getAttribute("aria-label")!.split(" Result ").at(-1),
        ),
      );
    expect([...buttons].sort()).toEqual([...second.result_ids].sort());
    expect(await evidence.locator(".result-group").count()).toBeGreaterThan(1);
    await evidence
      .getByRole("button", { name: new RegExp(" Result " + id + "$") })
      .click();
    await expect(page.locator(`[data-result-id="${id}"]`)).toBeFocused();
    await page.goto(gatePage(batch.execution_batch_id));
    oldReport = await generate(page);
    expect(oldReport.snapshot_id).toBe(second.snapshot_id);
    const metricIndex = oldReport.metrics.findIndex(
      (metric: any) =>
        typeof metric.value === "number" && metric.result_ids.length,
    );
    const metric = oldReport.metrics[metricIndex];
    await page
      .getByRole("region", { name: "Metric " + metric.name, exact: true })
      .getByRole("button", { name: metric.value.toFixed(3), exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Metric Evidence", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".result-entry")).toHaveCount(
      metric.result_ids.length,
    );
  });
  test("frozen Reports make no live reads, stay unchanged after an override, and a stale second form shows the real 409", async ({
    page,
    context,
  }) => {
    await page.goto(`/#report/${project}/${oldReport.id}`);
    await expect(page.getByTestId("frozen-marker")).toContainText(
      oldReport.generated_at,
    );
    await expect(page.getByTestId("live-marker")).toHaveCount(0);
    const before = await page.getByTestId("frozen-report").textContent(),
      reads: string[] = [];
    page.on("request", (r) => reads.push(r.url()));
    const operator = await context.newPage(),
      stale = await context.newPage();
    for (const tab of [operator, stale]) {
      await tab.goto(gatePage(batch.execution_batch_id));
      await recordOverride(
        tab,
        "semantic-readiness",
        "Accept this exact recorded finding for the demonstration.",
      );
      await expect(
        tab.getByRole("region", { name: "Override form" }),
      ).toContainText(second.gates["semantic-readiness"].id);
      await expect(
        tab.getByRole("region", { name: "Override form" }),
      ).toContainText(batch.execution_batch_id);
    }
    const received = operator.waitForResponse(
      (r) =>
        r.url().endsWith("/semantic-readiness/override") &&
        r.request().method() === "POST",
    );
    await operator
      .getByRole("button", {
        name: "Record this GateResult override",
        exact: true,
      })
      .click();
    const response = await received;
    expect(response.status()).toBe(201);
    const override = await response.json();
    expect(Object.keys(response.request().postDataJSON()).sort()).toEqual([
      "execution_batch_id",
      "gate_result_id",
      "justification",
    ]);
    await expect(gate(operator, "semantic-readiness")).toContainText(
      "status: fail",
    );
    await expect(gate(operator, "semantic-readiness")).toContainText(
      "overridden",
    );
    await expect(gate(operator, "semantic-readiness")).toContainText(
      override.approval_role,
    );
    await expect(gate(operator, "semantic-readiness")).toContainText(
      override.approved_at,
    );
    const refused = stale.waitForResponse(
      (r) =>
        r.url().endsWith("/semantic-readiness/override") &&
        r.request().method() === "POST",
    );
    await stale
      .getByRole("button", {
        name: "Record this GateResult override",
        exact: true,
      })
      .click();
    const rejection = await refused;
    expect(rejection.status()).toBe(409);
    const body = await rejection.text();
    await expect(stale.getByRole("alert")).toHaveText("HTTP 409\n" + body);
    newReport = await generate(operator);
    expect(newReport.gates["semantic-readiness"].override).toBe(
      override.approval_id,
    );
    await expect(gate(operator, "semantic-readiness")).toContainText(
      "status: fail",
    );
    await page.waitForTimeout(LIVE_INTERVAL + 150);
    expect(
      reads.filter((url) => !url.endsWith(`/reports/${oldReport.id}`)),
    ).toEqual([]);
    expect(await page.getByTestId("frozen-report").textContent()).toBe(before);
    expect(
      await (await page.request.get(`${root}/reports/${oldReport.id}`)).json(),
    ).toEqual(oldReport);
    await operator.close();
    await stale.close();
  });
  test("a new evaluation has new IDs and inherits no override on an older GateResult", async ({
    page,
  }) => {
    await page.goto(gatePage(batch.execution_batch_id));
    await expect(gate(page, "semantic-readiness")).toContainText("overridden");
    third = await evaluate(page);
    expect(third.gates["semantic-readiness"].id).not.toBe(
      second.gates["semantic-readiness"].id,
    );
    await expect(gate(page, "semantic-readiness")).not.toContainText(
      "overridden",
    );
    await expect(
      page.getByRole("button", {
        name: "Override semantic-readiness",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("region", { name: "Evaluation history" })
      .getByRole("button", { name: new RegExp(second.snapshot_id) })
      .click();
    await expect(gate(page, "semantic-readiness")).toContainText("overridden");
    await expect(
      page.getByRole("button", {
        name: "Override semantic-readiness",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("region", { name: "Evaluation history" })
      .getByRole("button", { name: new RegExp(third.snapshot_id) })
      .click();
    newReport = await generate(page);
    expect(newReport.snapshot_id).toBe(third.snapshot_id);
  });
  test("Dashboard polls engine data, shows returned open work and a gapped Trend, without generating Reports or evaluating Gates", async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posts.push(r.url());
    });
    await page.goto(
      `/#dashboard/${project}/release-readiness/local-simulation`,
    );
    await expect(page.getByTestId("live-marker")).toBeVisible();
    await expect(page.getByTestId("frozen-marker")).toHaveCount(0);
    await expect(page.getByTestId("last-refresh")).not.toHaveText(
      "not refreshed yet",
    );
    const time = await page.getByTestId("last-refresh").textContent();
    await expect(page.getByRole("region", { name: "Open work" })).toContainText(
      "release-safety-review",
    );
    await expect(
      page.getByRole("region", { name: "Latest Result counts" }),
    ).toContainText("counts, not a verdict");
    const safety = page.getByRole("img", {
      name: "Engine values for minimum-safety-basis",
      exact: true,
    });
    await expect(safety.locator("path")).toHaveAttribute("d", "");
    const all = await sourceResults(page),
      pending = all.find((r: any) => r.clause === "safety-review");
    const response = await page.request.post(
      `${root}/executions/${pending.execution}/results/${pending.id}/review`,
      {
        data: {
          verdict: "pass",
          supporting_evidence: {
            reason: "Independent UI-6 review of frozen release Evidence.",
          },
        },
      },
    );
    expect(response.status()).toBe(201);
    await page.waitForFunction(
      (previous) =>
        document.querySelector('[data-testid="last-refresh"]')?.textContent !==
        previous,
      time,
    );
    await expect(
      page.getByRole("region", { name: "Open work" }),
    ).not.toContainText("release-safety-review");
    expect(
      posts.filter(
        (url) => url.endsWith("/reports") || url.endsWith("/gates/check"),
      ),
    ).toEqual([]);
    await expect(
      page.getByRole("region", { name: "Gate Trends" }),
    ).toContainText("values as evaluated by the engine");
    await page.screenshot({ path: ".local/ui6-dashboard.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: ".local/ui6-dashboard-mobile.png" });
  });
  test("Release Decision has no default, engine rejects an approved failure, records rejection, then refuses stale configuration verbatim", async ({
    page,
    context,
  }) => {
    const fresh = await page.request.post(root + "/reports", {
      data: { execution_batch_id: batch.execution_batch_id },
    });
    expect(fresh.status()).toBe(201);
    newReport = await fresh.json();
    await page.goto(`/#releases/${project}/${batch.execution_batch_id}`);
    await page
      .getByLabel("Report for this decision", { exact: true })
      .selectOption(newReport.id);
    await expect(
      page.getByLabel("Release decision (choose explicitly)", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByRole("button", {
        name: "Record Release Decision",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByLabel("Release decision (choose explicitly)", { exact: true })
      .selectOption("approved");
    await page
      .getByLabel("Release notes", { exact: true })
      .fill("Read all recorded blocking and advisory Gate findings.");
    const refused = page.waitForResponse(
      (r) =>
        r.url().endsWith(root + "/releases") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Release Decision", exact: true })
      .click();
    const invalid = await refused;
    expect(invalid.status()).toBe(409);
    await expect(page.getByRole("alert")).toHaveText(
      "HTTP 409\n" + (await invalid.text()),
    );
    await page
      .getByLabel("Release decision (choose explicitly)", { exact: true })
      .selectOption("rejected");
    const accepted = page.waitForResponse(
      (r) =>
        r.url().endsWith(root + "/releases") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Release Decision", exact: true })
      .click();
    const recorded = await accepted;
    expect(recorded.status()).toBe(201);
    release = await recorded.json();
    expect(Object.keys(recorded.request().postDataJSON()).sort()).toEqual([
      "decision",
      "execution_batch_id",
      "notes",
      "report_id",
      "snapshot_id",
    ]);
    await expect(
      page.getByRole("region", { name: "Release Decision history" }),
    ).toContainText(release.id);
    await expect(
      page.getByRole("region", { name: "Release Decision history" }),
    ).toContainText("Advisory");
    const editor = await context.newPage();
    const changed = structuredClone(definition),
      scenario = changed.project.suites[0].scenarios.find(
        (s: any) => s.name === "semantic-fail",
      );
    scenario.contract.expectations[0].criteria +=
      " Review the current clause version.";
    await applySource(
      editor,
      stringify(changed),
      "Review the current clause version.",
    );
    await editor.close();
    await page
      .getByLabel("Release decision (choose explicitly)", { exact: true })
      .selectOption("rejected");
    const stale = page.waitForResponse(
      (r) =>
        r.url().endsWith(root + "/releases") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Release Decision", exact: true })
      .click();
    const staleResponse = await stale;
    expect(staleResponse.status()).toBe(409);
    await expect(page.getByRole("alert")).toHaveText(
      "HTTP 409\n" + (await staleResponse.text()),
    );
    await expect(
      page.getByRole("link", {
        name: "Re-evaluate all Gates and regenerate the Report →",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await (await page.request.get(`${root}/releases/${release.id}`)).json(),
    ).toEqual(release);
    await page.goto(gatePage(batch.execution_batch_id));
    const evaluated = await evaluate(page);
    expect(evaluated.gates["semantic-readiness"].reasons).toContain(
      "stale_results",
    );
    await exactReasons(
      page,
      "semantic-readiness",
      evaluated.gates["semantic-readiness"].reasons,
    );
  });
  test("Trend never bridges not_computed and the bootstrap Roles grant the declared override permissions", async ({
    page,
  }) => {
    const path = linePath([0.9, null, 0.8]);
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).not.toContain("L");
    const roles = await (
      await page.request.get("/api/roles?limit=1000")
    ).json();
    expect(roles.find((r: any) => r.name === "admin").permissions).toEqual(
      expect.arrayContaining(["gate_override", "release_decide"]),
    );
    expect(
      roles.find((r: any) => r.name === "aster-reviewer").permissions,
    ).toContain("review");
  });
  test("override permission and unknown GateResult refusals are real 403 and 404 responses shown verbatim", async ({
    page,
  }) => {
    const changed = structuredClone(definition);
    changed.project.quality_gates.find(
      (g: any) => g.name === "semantic-readiness",
    ).override_requires = "ui6_unheld_override_permission";
    await applySource(
      page,
      stringify(changed),
      "ui6_unheld_override_permission",
    );
    await page.goto(gatePage(batch.execution_batch_id));
    await evaluate(page);
    await recordOverride(
      page,
      "semantic-readiness",
      "An explicit attempt without the additional Gate permission.",
    );
    const forbidden = page.waitForResponse(
      (r) =>
        r.url().endsWith("/semantic-readiness/override") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: "Record this GateResult override",
        exact: true,
      })
      .click();
    const denial = await forbidden;
    expect(denial.status()).toBe(403);
    await expect(page.getByRole("alert")).toHaveText(
      "HTTP 403\n" + (await denial.text()),
    );
    await page.route("**/semantic-readiness/override", async (route) => {
      const body = route.request().postDataJSON();
      body.gate_result_id = "not-a-recorded-gate-result";
      const response = await route.fetch({ postData: JSON.stringify(body) });
      expect(response.status()).toBe(404);
      await route.fulfill({ response });
    });
    const missing = page.waitForResponse(
      (r) =>
        r.url().endsWith("/semantic-readiness/override") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", {
        name: "Record this GateResult override",
        exact: true,
      })
      .click();
    const absence = await missing;
    expect(absence.status()).toBe(404);
    await expect(page.getByRole("alert")).toHaveText(
      "HTTP 404\n" + (await absence.text()),
    );
  });
});
