import { test, expect } from "@playwright/test";

test("sample is loaded, search filters, Scenario opens read-only", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Test Explorer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "grounded-refund", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not run", { exact: true })).toHaveCount(20);
  await expect(page.getByText("No Baseline", { exact: true })).toHaveCount(20);
  await page.screenshot({
    path: ".local/explorer-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search Scenarios" })
    .fill("unsupported-claim");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Inspect unsupported-claim", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "unsupported-claim", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Not run. No verdict or Confidence is available."),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Close ×" }).press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Connections distinguishes deliberately unavailable Judge", async ({
  page,
}) => {
  await page.goto("/#connections");
  await expect(
    page.getByRole("heading", { name: "Connections", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("available", { exact: true })).toHaveCount(4);
  await expect(page.getByText("unavailable", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText("No secret_ref is used in Stage 1.", { exact: false }),
  ).toBeVisible();
});

test("engine rejection is shown verbatim, not as an empty or passing state", async ({
  page,
}) => {
  await page.route("**/api/projects?*", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: '{"detail":"Permission denied: read (Volume XII)"}',
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("HTTP 403");
  await expect(page.getByRole("alert")).toContainText(
    '{"detail":"Permission denied: read (Volume XII)"}',
  );
  await expect(page.getByText("Not run", { exact: true })).toHaveCount(0);
});

test("narrow screen retains navigation and readable Scenario table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "grounded-refund", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.screenshot({ path: ".local/explorer-mobile.png", fullPage: true });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > innerWidth + 1 &&
          getComputedStyle(e).position !== "absolute",
      )
      .map(
        (e) =>
          `${e.tagName}.${e.className}: ${e.getBoundingClientRect().right}`,
      )
      .slice(0, 12),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    JSON.stringify(overflow),
  ).toBe(true);
});

test("real run appears with engine Results and opens frozen Evidence", async ({
  page,
}) => {
  await page.goto("/");
  const response = await page.request.post(
    "/api/projects/aster-support/executions",
    { data: { suite: "support-behaviours", environment: "local-simulation" } },
  );
  expect(response.status()).toBe(201);
  await page.reload();
  await expect(
    page.getByText("counts, not a verdict", { exact: true }),
  ).toHaveCount(12);
  await expect(page.locator(".scenario-result-details[open]")).toHaveCount(0);
  const unsupported = page
    .locator("tbody tr")
    .filter({ hasText: "unsupported-claim" });
  await unsupported.locator("summary").click();
  await expect(
    unsupported.getByText("actionable · fail", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect unsupported-claim", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your refund is $99.");
  await expect(dialog).toContainText("retrieved_context");
  await expect(
    dialog.getByRole("heading", { name: "Results returned by the engine" }),
  ).toBeVisible();
  const validator = dialog
    .locator(".result-group")
    .filter({ has: page.locator("strong", { hasText: "response-is-text" }) });
  await expect(validator).toContainText("Validator · schema");
  await expect(validator).toContainText("Confidence: not applicable");
  const grounding = dialog
    .locator(".result-group")
    .filter({ has: page.locator("strong", { hasText: /^grounding$/ }) });
  await expect(grounding).toContainText("Judge · aster-sim-judge-reliable@1");
  await expect(grounding).toContainText("Confidence: 0.94");
  await grounding
    .getByRole("button", { name: /Evidence for grounding Result/ })
    .click();
  await expect(
    dialog.getByRole("region", { name: "Selected Result Evidence" }),
  ).toContainText("Your refund is $99.");
  await expect(
    dialog.getByRole("region", { name: "Selected Result Evidence" }),
  ).toContainText("unsupported currency amount");
});

test("Result renderer groups unnamed clauses and shows recorded resolution links without deriving them", async ({
  page,
}) => {
  await page.route("**/executions/*/results?*", async (route) => {
    const response = await route.fetch();
    const records = await response.json();
    if (!records.length) {
      await route.fulfill({ response });
      return;
    }
    const first = {
      ...records[0],
      clause: "sha256:renderer-fixture/constraints/0",
    };
    const resolution = {
      ...first,
      id: "recorded-resolution-fixture",
      resolves: first.id,
    };
    await route.fulfill({ response, json: [first, resolution] });
  });
  await page.goto("/");
  await page.locator(".scenario-result-details summary").first().click();
  await expect(
    page
      .getByText("unnamed clause · constraints position 1", { exact: true })
      .first(),
  ).toBeVisible();
  const resolution = page.locator(".resolution").first();
  await expect(resolution).toContainText("Resolves Result");
  await expect(resolution).toContainText("(engine record)");
});
