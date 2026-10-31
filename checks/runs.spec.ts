import { test, expect, type Page } from "@playwright/test";
import type { Batch } from "../src/runs/api";
let infrastructure: Batch, first: Batch, second: Batch;
let originalResults: Record<string, unknown> = {};
const base = "/api/projects/aster-support";
async function resultRows(page: Page, id: string) {
  return (
    await page.request.get(`${base}/executions/${id}/results?limit=1000`)
  ).json();
}
async function show(page: Page, id: string) {
  await page.goto(`/#runs/aster-support/${id}`);
  await expect(
    page.getByRole("heading", { name: `Execution ${id}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh Execution", exact: true }),
  ).toBeEnabled();
}
async function run(page: Page, suite = "support-behaviours") {
  await page.goto("/#runs");
  await page.getByLabel("Run Suite", { exact: true }).selectOption(suite);
  await page
    .getByLabel("Run Environment", { exact: true })
    .selectOption("local-simulation");
  const received = page.waitForResponse(
    (r) =>
      r.url().endsWith(base + "/executions") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Start new batch", exact: true })
    .click();
  const response = await received;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({
    suite,
    environment: "local-simulation",
  });
  const batch = (await response.json()) as Batch;
  await expect(
    page.getByRole("region", {
      name: `Returned batch ${batch.execution_batch_id}`,
      exact: true,
    }),
  ).toBeVisible();
  return batch;
}
const scenario = (batch: Batch, name: string) =>
  batch.executions.find((e) => e.scenario === name)!;
test.describe.serial("UI-4 independent Runs and Evidence checks", () => {
  test("all returned Executions remain visible, infrastructure failure has no completed transcript, Confidence capture is explicit", async ({
    page,
  }) => {
    const created = await page.request.post(base + "/suites", {
      data: {
        name: "ui4-infrastructure",
        scenarios: [
          {
            name: "captured-human",
            prompt: { template: "Refund question" },
            variables: { sim_case: "grounded" },
            contract: {
              expectations: [
                {
                  id: "captured-signoff",
                  criteria: "Inspect the policy",
                  confidence_threshold: 0.8,
                  human_reviewer: {
                    role: "aster-reviewer",
                    captures_confidence: true,
                  },
                  review_timeout: "24h",
                },
              ],
            },
          },
          {
            name: "transport-failure",
            prompt: { template: "A provider failure" },
            variables: { sim_case: "unknown-own-check-case" },
          },
        ],
      },
    });
    expect(created.status()).toBe(201);
    infrastructure = await run(page, "ui4-infrastructure");
    expect(infrastructure.executions).toHaveLength(2);
    const failed = scenario(infrastructure, "transport-failure");
    expect(failed.status).toBe("infrastructure_failure");
    const returned = page.getByRole("region", {
      name: `Returned batch ${infrastructure.execution_batch_id}`,
      exact: true,
    });
    await expect(returned).toContainText(
      "Infrastructure failure — no quality verdict",
    );
    await expect(returned.getByRole("link")).toHaveCount(2);
    await show(page, failed.id);
    await expect(
      page.getByText("no completed transcript", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("HTTP 409");
    await expect(
      page.getByRole("button", { name: "Review this Result", exact: true }),
    ).toHaveCount(0);
    await show(page, scenario(infrastructure, "captured-human").id);
    await page
      .getByRole("button", { name: "Review this Result", exact: true })
      .click();
    await page
      .getByLabel("Review verdict", { exact: true })
      .selectOption("pass");
    await page
      .getByLabel("Supporting reason", { exact: true })
      .fill("Checked the frozen policy.");
    await expect(
      page.getByRole("button", { name: "Record Human Review", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Review Confidence", { exact: true }).fill("1.1");
    await expect(
      page.getByRole("button", { name: "Record Human Review", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Review Confidence", { exact: true }).fill("0.95");
    await page
      .getByRole("button", { name: "Record Human Review", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("completed in place");
  });
  test("two runs create separate batches and preserve every first-batch Result", async ({
    page,
  }) => {
    first = await run(page);
    for (const e of first.executions)
      originalResults[e.id] = await resultRows(page, e.id);
    second = await run(page);
    expect(second.execution_batch_id).not.toBe(first.execution_batch_id);
    await expect(
      page.getByRole("region", {
        name: `Batch ${first.execution_batch_id}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: `Batch ${second.execution_batch_id}`,
        exact: true,
      }),
    ).toBeVisible();
    for (const e of first.executions)
      expect(await resultRows(page, e.id)).toEqual(originalResults[e.id]);
    await page.screenshot({ path: ".local/ui4-runs.png", fullPage: true });
  });
  test("engine inconclusive Result gains a linked Human record; no uncaptured Confidence field is sent", async ({
    page,
  }) => {
    const execution = scenario(second, "approximate-amount");
    const before = await resultRows(page, execution.id);
    const original = before.find((r: any) => r.oracle_type === "judge");
    expect(original.disposition).toBe("inconclusive");
    expect(original.verdict).toBe("pass");
    expect(original.confidence).toBe(0.6);
    await show(page, execution.id);
    await expect(
      page.getByRole("region", { name: "Frozen configuration" }),
    ).toContainText(
      "frozen at execution; later configuration changes do not apply here",
    );
    await page
      .getByRole("button", { name: "Review this Result", exact: true })
      .click();
    await expect(
      page.getByLabel("Review verdict", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByLabel("Review Confidence", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Review verdict", { exact: true })
      .selectOption("fail");
    await expect(
      page.getByRole("button", { name: "Record Human Review", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Supporting reason", { exact: true })
      .fill(
        "The exact recorded amount is $49.99; approximation does not meet this review.",
      );
    const sent = page.waitForRequest((r) => r.url().endsWith("/review"));
    await page
      .getByRole("button", { name: "Record Human Review", exact: true })
      .click();
    expect((await sent).postDataJSON()).toEqual({
      verdict: "fail",
      supporting_evidence: {
        reason:
          "The exact recorded amount is $49.99; approximation does not meet this review.",
      },
    });
    await expect(page.getByRole("status")).toContainText("New Human Result");
    const after = await resultRows(page, execution.id);
    expect(after.find((r: any) => r.id === original.id)).toEqual(original);
    const human = after.find((r: any) => r.resolves === original.id);
    expect(human.oracle_type).toBe("human_reviewer");
    expect(human.confidence).toBe("not_applicable");
    const chain = page
      .getByRole("region", { name: /Resolution chain \d+/ })
      .filter({ has: page.locator(`[data-result-id="${original.id}"]`) });
    await expect(chain.locator(".chain-link")).toHaveCount(2);
    expect(
      await chain
        .locator(".chain-link")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-result-id")),
        ),
    ).toEqual([original.id, human.id]);
    await expect(chain.locator(".chain-link").last()).toContainText(
      "latest in this chain",
    );
    await expect(
      chain
        .locator(".chain-link")
        .first()
        .getByRole("button", { name: "Review this Result", exact: true }),
    ).toHaveCount(0);
  });
  test("flaky outage re-checks form a three-link chain with unchanged Oracle and no subject calls", async ({
    page,
  }) => {
    const execution = scenario(second, "recoverable-outage");
    await show(page, execution.id);
    const original = (await resultRows(page, execution.id)).find(
      (r: any) => r.oracle_type === "judge",
    );
    expect(original.disposition).toBe("oracle_unavailable");
    const count = (await (await page.request.get("/sim-control/flaky")).json())
      .subject_calls;
    const request = page.waitForRequest((r) => r.url().endsWith("/reassess"));
    await page
      .getByRole("button", {
        name: "Re-check with the same Oracle",
        exact: true,
      })
      .click();
    expect((await request).postDataJSON()).toEqual({ oracle: original.oracle });
    await expect(page.getByRole("status")).toContainText(
      "Re-check recorded oracle_unavailable",
    );
    let rows = await resultRows(page, execution.id);
    const unavailable = rows.find((r: any) => r.resolves === original.id);
    expect(unavailable.disposition).toBe("oracle_unavailable");
    await page.goto("/#connections");
    await page
      .getByRole("button", { name: "Turn flaky outage off", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Simulator control" }),
    ).toContainText("Flaky outage: off");
    await show(page, execution.id);
    await page
      .getByRole("button", {
        name: "Re-check with the same Oracle",
        exact: true,
      })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Re-check recorded actionable",
    );
    rows = await resultRows(page, execution.id);
    const recovered = rows.find((r: any) => r.resolves === unavailable.id);
    expect(recovered.disposition).toBe("actionable");
    expect(rows.find((r: any) => r.id === original.id)).toEqual(original);
    const chain = page
      .getByRole("region", { name: /Resolution chain \d+/ })
      .filter({ has: page.locator(`[data-result-id="${original.id}"]`) });
    await expect(chain.locator(".chain-link")).toHaveCount(3);
    expect(
      (await (await page.request.get("/sim-control/flaky")).json())
        .subject_calls,
    ).toBe(count);
    await expect(
      page.getByRole("button", {
        name: "Re-check with the same Oracle",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.screenshot({
      path: ".local/ui4-recovery-chain.png",
      fullPage: true,
    });
    await page.request.post("/sim-control/flaky", {
      data: { unavailable: true },
    });
  });
  test("direct Human review: real missing-Role refusal is verbatim, valid review completes in place", async ({
    page,
  }) => {
    const execution = scenario(second, "human-signoff");
    const original = (await resultRows(page, execution.id)).find(
      (r: any) => r.oracle_type === "human_reviewer",
    );
    expect(original.disposition).toBe("awaiting_review");
    await show(page, execution.id);
    await expect(
      page.getByRole("region", { name: "Review route" }),
    ).toContainText("aster-reviewer");
    await expect(
      page.getByRole("region", { name: "Review route" }),
    ).toContainText("required_roles");
    await page
      .getByRole("button", { name: "Review this Result", exact: true })
      .click();
    await page
      .getByLabel("Review verdict", { exact: true })
      .selectOption("pass");
    await page
      .getByLabel("Supporting reason", { exact: true })
      .fill("Inspected Conversation and policy.");
    await expect(
      page.getByLabel("Review Confidence", { exact: true }),
    ).toHaveCount(0);
    await page.route("**/results/*/review", async (route) => {
      const url = new URL(route.request().url());
      const response = await page.request.post(
        "http://127.0.0.1:8000" + url.pathname.replace(/^\/api/, ""),
        {
          headers: {
            Authorization: "Bearer " + process.env.AQEF_CHECK_ADMIN_TOKEN,
          },
          data: route.request().postDataJSON(),
        },
      );
      expect(response.status()).toBe(403);
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Record Human Review", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP 403");
    await expect(page.getByRole("alert")).toContainText(
      `Reviewer lacks clause's required Role`,
    );
    expect(
      (await resultRows(page, execution.id)).find(
        (r: any) => r.id === original.id,
      ).disposition,
    ).toBe("awaiting_review");
    await page.unroute("**/results/*/review");
    await page
      .getByRole("button", { name: "Record Human Review", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("completed in place");
    const after = await resultRows(page, execution.id),
      completed = after.find((r: any) => r.id === original.id);
    expect(after).toHaveLength(3);
    expect(completed.recorded_at).toBe(original.recorded_at);
    expect(completed.verdict).toBe("pass");
    expect(completed).not.toHaveProperty("resolves");
  });
  test("panel members and counts match recorded output, Execution filters and errors are sent to engine", async ({
    page,
  }) => {
    const execution = scenario(second, "panel-disagreement");
    const panel = (await resultRows(page, execution.id)).find(
      (r: any) => r.panel,
    );
    expect(panel.supporting_evidence.member_results).toHaveLength(3);
    await show(page, execution.id);
    const members = page.getByRole("region", {
      name: "Recorded panel members",
    });
    await expect(members.locator(".panel-member")).toHaveCount(3);
    for (const member of panel.supporting_evidence.member_results) {
      await expect(members).toContainText(member.id);
      await expect(members).toContainText(member.verdict);
    }
    await expect(
      page.getByText("Panel counts — recorded by engine", { exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: ".local/ui4-evidence-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/#runs");
    await page
      .getByLabel("Filter Suite", { exact: true })
      .selectOption("ui4-infrastructure");
    await page
      .getByLabel("Filter status", { exact: true })
      .selectOption("infrastructure_failure");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(
      page.getByRole("region", {
        name: `Batch ${infrastructure.execution_batch_id}`,
        exact: true,
      }),
    ).toContainText("1 matching Executions");
    await page
      .getByLabel("Date from (ISO, with timezone)", { exact: true })
      .fill("2026-01-01T00:00:00");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP 422");
    await expect(page.getByRole("alert")).toContainText(
      "Date filters must include a timezone",
    );
  });
  test("stale Human review and run preflight refusals remain verbatim", async ({
    page,
  }) => {
    const execution = scenario(first, "approximate-amount");
    const original = (await resultRows(page, execution.id)).find(
      (r: any) => r.oracle_type === "judge",
    );
    await show(page, execution.id);
    await page
      .getByRole("button", { name: "Review this Result", exact: true })
      .click();
    await page
      .getByLabel("Review verdict", { exact: true })
      .selectOption("pass");
    await page
      .getByLabel("Supporting reason", { exact: true })
      .fill("A concurrent review already settled this.");
    expect(
      (
        await page.request.post(
          `${base}/executions/${execution.id}/results/${original.id}/review`,
          {
            data: {
              verdict: "pass",
              supporting_evidence: { reason: "Concurrent Person action" },
            },
          },
        )
      ).status(),
    ).toBe(201);
    await page
      .getByRole("button", { name: "Record Human Review", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP 409");
    await expect(page.getByRole("alert")).toContainText(
      "Only current non-actionable effective Result may be resolved",
    );
    await page.goto("/#runs");
    await page
      .getByLabel("Run Suite", { exact: true })
      .selectOption("support-behaviours");
    await page
      .getByLabel("Run Environment", { exact: true })
      .selectOption("local-simulation");
    for (const data of [
      { suite: "missing-own-check-suite", environment: "local-simulation" },
      { environment: "local-simulation" },
    ]) {
      let expected = "";
      await page.route(
        "**/api/projects/aster-support/executions",
        async (route) => {
          const response = await route.fetch({
            postData: JSON.stringify(data),
          });
          expected = await response.text();
          await route.fulfill({ response });
        },
      );
      await page
        .getByRole("button", { name: "Start new batch", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "HTTP " + ("suite" in data ? "404" : "422"),
      );
      await expect(page.getByRole("alert")).toContainText(expected);
      await page.unroute("**/api/projects/aster-support/executions");
    }
  });
  test("all engine pages are grouped before display pagination, including a batch crossing an API boundary", async ({
    page,
  }) => {
    const template = first.executions[0];
    const fixture = Array.from({ length: 201 }, (_, index) => ({
      ...template,
      id: "pagination-" + index,
      execution_batch_id: "page-batch-" + Math.floor(index / 18),
    }));
    const offsets: number[] = [];
    await page.route("**/api/projects/aster-support/executions?*", (route) => {
      const query = new URL(route.request().url()).searchParams;
      const offset = Number(query.get("offset"));
      offsets.push(offset);
      return route.fulfill({
        json: fixture.slice(offset, offset + Number(query.get("limit"))),
      });
    });
    await page.route("**/executions/pagination-*/results?*", (route) =>
      route.fulfill({ json: [] }),
    );
    await page.goto("/#runs");
    await expect(
      page.getByText("Page 1 · 12 matching batches", { exact: true }),
    ).toBeVisible();
    expect(offsets).toContain(100);
    expect(offsets).toContain(200);
    await expect(page.locator(".run-batch")).toHaveCount(10);
    const crossing = page.getByRole("region", {
      name: "Batch page-batch-5",
      exact: true,
    });
    await expect(crossing).toContainText("18 matching Executions");
    await expect(crossing.getByRole("link")).toHaveCount(18);
    await page
      .getByRole("button", { name: "Next batches", exact: true })
      .click();
    await expect(page.locator(".run-batch")).toHaveCount(2);
    await expect(
      page
        .getByRole("region", { name: "Batch page-batch-0", exact: true })
        .getByRole("link"),
    ).toHaveCount(18);
  });
});
