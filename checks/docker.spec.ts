import { test, expect } from "@playwright/test";

test("built nginx exposes Oracle designers and refuses the subject as a Judge", async ({
  page,
}) => {
  await page.goto("/#judges");
  await expect(
    page.getByRole("heading", { name: "Judge Configuration", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Contract attachment", { exact: true })
    .selectOption({ label: "Scenario support-behaviours/unsupported-claim" });
  await page
    .getByLabel("Existing Expectation", { exact: true })
    .selectOption("0");
  await expect(
    page.getByText("Admission · no record", { exact: true }),
  ).toBeVisible();
  const project = await (
    await page.request.get("/api/projects/aster-support")
  ).json();
  await page
    .getByLabel("Judge 1 model", { exact: true })
    .fill(project.environments[0].model_version);
  await expect(
    page.getByRole("button", { name: "Review & Apply", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert").last()).toContainText(
    "Independent Oracles",
  );
  await page.goto("/#validators");
  await expect(
    page.getByRole("heading", { name: "Validator Designer", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Validator form" })
      .getByLabel(/confidence/i),
  ).toHaveCount(0);
});

test("nginx serves the built Explorer and the automatically loaded Aster workspace", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "grounded-refund", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page
    .getByRole("textbox", { name: "Search Scenarios" })
    .fill("unsupported-claim");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Inspect unsupported-claim", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("sim_case");
  await page.getByRole("button", { name: "Close ×" }).click();
  await page.getByRole("textbox", { name: "Search Scenarios" }).fill("");
  await page.screenshot({ path: ".local/docker-explorer.png", fullPage: true });
  // nginx authenticates server-side; the unauthenticated engine itself stays closed.
  expect((await page.request.get("/api/healthz")).status()).toBe(200);
  expect(
    (await page.request.get("http://127.0.0.1:8000/projects")).status(),
  ).toBe(401);
});

test("nginx routes health checks to all six simulated providers", async ({
  page,
}) => {
  await page.request.post("/sim-control/flaky", {
    data: { unavailable: true },
  });
  await page.goto("/#connections");
  await expect(page.getByText("available", { exact: true })).toHaveCount(4);
  await expect(page.getByText("unavailable", { exact: true })).toHaveCount(2);
  await page.screenshot({
    path: ".local/docker-connections.png",
    fullPage: true,
  });
});

test("workspace service is seeded and corrected sample applies through the shared preview", async ({
  page,
}) => {
  await page.goto("/#workspace");
  await expect(
    page.getByRole("button", { name: "project.yaml", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("yaml-editor")).toBeVisible();
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
});

test("container-to-container subject and Judge calls produce Results and Evidence", async ({
  page,
}) => {
  const response = await page.request.post(
    "/api/projects/aster-support/executions",
    {
      data: { suite: "support-behaviours", environment: "local-simulation" },
    },
  );
  expect(response.status()).toBe(201);
  const batch = await response.json();
  expect(batch.executions).toHaveLength(12);
  expect(
    batch.executions.every(
      (execution: { status: string }) => execution.status === "completed",
    ),
  ).toBe(true);
  const gates = await page.request.post(
    "/api/projects/aster-support/gates/check",
    {
      data: { execution_batch_id: batch.execution_batch_id },
    },
  );
  expect(gates.status()).toBe(200);
  expect((await gates.json()).gates["support-readiness"].status).toBe("fail");
  await page.goto("/");
  await page
    .locator("tbody tr")
    .filter({ hasText: "unsupported-claim" })
    .locator("summary")
    .click();
  await expect(
    page.getByText("actionable · fail", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect unsupported-claim", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Your refund is $99.");
  await expect(page.getByRole("dialog")).toContainText("retrieved_context");
  await page.screenshot({ path: ".local/docker-evidence.png", fullPage: true });
});

test("built Runs UI starts a new batch, reviews with the provisioned Role and recovers the flaky Judge", async ({
  page,
}) => {
  await page.request.post("/sim-control/flaky", {
    data: { unavailable: true },
  });
  await page.goto("/#runs");
  await page
    .getByLabel("Run Suite", { exact: true })
    .selectOption("support-behaviours");
  await page
    .getByLabel("Run Environment", { exact: true })
    .selectOption("local-simulation");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/projects/aster-support/executions") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Start new batch", exact: true })
    .click();
  const batch = await (await response).json();
  expect(batch.executions).toHaveLength(12);
  const human = batch.executions.find(
    (e: any) => e.scenario === "human-signoff",
  );
  await page.goto("/#runs/aster-support/" + human.id);
  await page
    .getByRole("button", { name: "Review this Result", exact: true })
    .click();
  await expect(
    page.getByLabel("Review Confidence", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Review verdict", { exact: true }).selectOption("pass");
  await page
    .getByLabel("Supporting reason", { exact: true })
    .fill("Docker verification: read frozen policy and response.");
  await page
    .getByRole("button", { name: "Record Human Review", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("completed in place");
  const flaky = batch.executions.find(
    (e: any) => e.scenario === "recoverable-outage",
  );
  await page.goto("/#runs/aster-support/" + flaky.id);
  await page
    .getByRole("button", { name: "Re-check with the same Oracle", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Re-check recorded oracle_unavailable",
  );
  await page.goto("/#connections");
  await page
    .getByRole("button", { name: "Turn flaky outage off", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Simulator control" }),
  ).toContainText("Flaky outage: off");
  await page.goto("/#runs/aster-support/" + flaky.id);
  await page
    .getByRole("button", { name: "Re-check with the same Oracle", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Re-check recorded actionable",
  );
  const records = await (
    await page.request.get(
      `/api/projects/aster-support/executions/${flaky.id}/results?limit=100`,
    )
  ).json();
  expect(records.filter((r: any) => r.oracle_type === "judge")).toHaveLength(3);
  await page.request.post("/sim-control/flaky", {
    data: { unavailable: true },
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: ".local/ui4-docker-evidence.png" });
});
