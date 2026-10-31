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
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page
    .getByRole("textbox", { name: "Search Scenarios" })
    .fill("unsupported");
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

test("nginx routes health checks to all five simulated providers", async ({
  page,
}) => {
  await page.goto("/#connections");
  await expect(page.getByText("available", { exact: true })).toHaveCount(4);
  await expect(page.getByText("unavailable", { exact: true })).toHaveCount(1);
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
  expect(batch.executions).toHaveLength(8);
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
