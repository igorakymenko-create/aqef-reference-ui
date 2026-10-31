import { test, expect } from "@playwright/test";

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
