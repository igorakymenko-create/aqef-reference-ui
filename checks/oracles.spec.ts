import { test, expect, type Page } from "@playwright/test";
import { parseAllDocuments, stringify } from "yaml";
import { judgeIdentity } from "../src/workspace/oracleRules";

const parse = (text: string) => parseAllDocuments(text)[0].toJS();
const attachment = "Scenario support-behaviours/unsupported-claim";
async function open(page: Page, mode: string) {
  await page.goto("/#" + mode);
  await expect(
    page.getByRole("button", { name: "project.yaml", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await page
    .getByRole("button", { name: "Review & Apply", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Apply preview" }),
  ).toBeVisible();
}
async function apply(page: Page) {
  await review(page);
  await page
    .getByRole("button", { name: "Confirm Apply", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Apply (complete|no changes)/ }),
  ).toBeVisible();
}
async function source(page: Page) {
  return (
    await (await page.request.get("/workspace/files?path=project.yaml")).json()
  ).content;
}
test.describe.serial("UI-3 Oracle authoring", () => {
  test("incomplete Designer lists missing fields and clears proposed YAML", async ({
    page,
  }) => {
    await open(page, "designer");
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "Form incomplete — choose:",
    );
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "No YAML is proposed yet.",
    );
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
  });
  test("custom model check refuses, transfers authored criteria and requires an explicit answer", async ({
    page,
  }) => {
    await open(page, "validators");
    await expect(
      page
        .getByRole("region", { name: "Validator form" })
        .getByLabel(/confidence/i),
    ).toHaveCount(0);
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("custom");
    await page
      .getByLabel("Custom Validator name", { exact: true })
      .fill("model-check");
    await page
      .getByLabel("Check description / proposed Judge criteria", {
        exact: true,
      })
      .fill("[grounding] Review claims");
    await page
      .getByLabel("Implementation/model identifier (optional)", { exact: true })
      .fill("aster-sim-judge-reliable@1");
    await expect(
      page
        .getByText("The identifier is a mapped model provider.", {
          exact: false,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Open Judge Configuration with entered draft",
      })
      .click();
    await expect(
      page.getByLabel("Judge criteria", { exact: true }),
    ).toHaveValue("[grounding] Review claims");
    await expect(page.getByLabel("Judge 1 model", { exact: true })).toHaveValue(
      "aster-sim-judge-reliable@1",
    );
    await page.goto("/#validators");
    await page.reload();
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("custom");
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "whether the check calls a model",
    );
    await page
      .getByLabel(
        "Does this check call a model, or any non-deterministic service, to decide pass or fail?",
        { exact: true },
      )
      .selectOption("yes");
    await expect(page.getByRole("alert").last()).toContainText(
      "MUST be deterministic",
    );
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("built-in");
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "Form incomplete — choose:",
    );
    await expect(
      page.getByRole("button", {
        name: "Open Judge Configuration with entered draft",
      }),
    ).toHaveCount(0);
  });
  test("built-in editing and pure Custom Validator registration use shared preview and engine registry", async ({
    page,
  }) => {
    await open(page, "validators");
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("built-in");
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: "Project · support-quality" });
    await page
      .getByLabel("Existing Constraint", { exact: true })
      .selectOption({ label: "response-is-text" });
    await page
      .getByLabel("Expected (YAML)", { exact: true })
      .fill("type: string\nminLength: 2");
    await apply(page);
    await page.reload();
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("custom");
    await page
      .getByLabel("Project", { exact: true })
      .selectOption("aster-support");
    await page
      .getByLabel("Custom Validator name", { exact: true })
      .fill("ui3-range");
    await page
      .getByLabel("Custom Validator version", { exact: true })
      .fill("1");
    await page
      .getByLabel(
        "Does this check call a model, or any non-deterministic service, to decide pass or fail?",
        { exact: true },
      )
      .selectOption("no");
    await page
      .getByLabel("Registration mode", { exact: true })
      .selectOption("only");
    await page
      .getByLabel("Deterministic operation", { exact: true })
      .selectOption("range");
    await page.getByLabel("Rule minimum", { exact: true }).fill("0");
    await page.getByLabel("Rule maximum", { exact: true }).fill("2000");
    await apply(page);
    const rows = await (
      await page.request.get("/api/projects/aster-support/validators?limit=100")
    ).json();
    expect(rows.find((r: any) => r.name === "ui3-range").rule).toEqual({
      operation: "range",
      minimum: 0,
      maximum: 2000,
    });
  });
  test("YAML Confidence, missing Multi purpose and subject identity are hard preview refusals without writes", async ({
    page,
  }) => {
    await open(page, "workspace");
    const before = await source(page);
    const doc = parse(before);
    const scenario = doc.project.suites[0].scenarios.find(
      (s: any) => s.name === "unsupported-claim",
    );
    for (const mutation of ["confidence", "purpose", "identity", "mapped"]) {
      const candidate = structuredClone(doc);
      const c = candidate.project.suites[0].scenarios.find(
        (s: any) => s.name === "unsupported-claim",
      ).contract;
      if (mutation === "confidence")
        candidate.project.contracts[0].constraints[0].confidence_threshold = 0.9;
      if (mutation === "purpose") {
        delete c.expectations[0].judge;
        c.expectations[0].multi_judge = {
          judges: [
            { model: "a", confidence_source: "self_rating" },
            { model: "b", confidence_source: "self_rating" },
          ],
          consensus: { method: "voting" },
        };
      }
      if (mutation === "identity")
        c.expectations[0].judge.model =
          candidate.project.environments[0].model_version;
      if (mutation === "mapped")
        candidate.project.contracts[0].constraints[0].validator =
          "aster-sim-judge-reliable@1";
      await page
        .getByTestId("yaml-editor")
        .fill(stringify(candidate) + before.slice(before.indexOf("\n---\n")));
      await page
        .getByRole("button", { name: "Review & Apply", exact: true })
        .click();
      await expect(page.getByRole("alert").last()).toContainText(
        mutation === "purpose"
          ? "explicit purpose"
          : mutation === "identity"
            ? "Independent Oracles"
            : "MUST be deterministic",
      );
      await expect(
        page.getByRole("button", { name: "Confirm Apply", exact: true }),
      ).toHaveCount(0);
      expect(await source(page)).toBe(before);
    }
    expect(scenario.contract.expectations).toHaveLength(1);
  });
  test("Single Judge latest Admission is read only; changed criteria warns and family is advisory", async ({
    page,
  }) => {
    const config = {
      model: "aster-sim-judge-reliable@1",
      confidence_source: "self_rating",
    };
    const saved = parse(await source(page)).project;
    const criteria = saved.suites[0].scenarios.find(
      (s: any) => s.name === "unsupported-claim",
    ).contract.expectations[0].criteria;
    const oracle = judgeIdentity(config, criteria);
    await page.route("**/admissions?*", (route) =>
      route.fulfill({
        json: [
          { oracle, admitted: true },
          { oracle, admitted: false },
        ],
      }),
    );
    await open(page, "judges");
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: attachment });
    await page
      .getByLabel("Existing Expectation", { exact: true })
      .selectOption("0");
    await expect(
      page.getByText("Admission · not admitted", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Judge 1 model", { exact: true })
      .fill(saved.environments[0].model_version);
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("alert").last()).toContainText(
      "Independent Oracles",
    );
    await page.getByLabel("Judge 1 model", { exact: true }).fill(config.model);
    await page
      .getByLabel("Judge criteria", { exact: true })
      .fill(criteria + " Only supported claims.");
    await expect(
      page.getByText("Admission · no record", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("note").first()).toContainText(
      "New Judge configuration",
    );
    await review(page);
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("New Judge configuration");
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("SHOULD NOT");
    await page
      .getByRole("button", { name: "Confirm Apply", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
  });
  test("Multi purpose has no default; stability and independence preserve omitted Consensus defaults", async ({
    page,
  }) => {
    await open(page, "judges");
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: attachment });
    await page
      .getByLabel("Existing Expectation", { exact: true })
      .selectOption("0");
    await page.getByLabel("Judge type", { exact: true }).selectOption("multi");
    await expect(
      page.getByLabel("Multi Judge purpose", { exact: true }),
    ).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Multi Judge purpose", { exact: true })
      .selectOption("stability");
    await page.getByLabel("Sample count", { exact: true }).fill("3");
    await page
      .getByLabel("Consensus method", { exact: true })
      .selectOption("voting");
    await apply(page);
    const doc = parse(await source(page));
    const panel = doc.project.suites[0].scenarios.find(
      (s: any) => s.name === "unsupported-claim",
    ).contract.expectations[0].multi_judge;
    expect(panel.purpose).toBe("stability");
    expect(panel.samples).toBe(3);
    expect(panel.consensus).toEqual({ method: "voting" });
    await page.reload();
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: attachment });
    await page
      .getByLabel("Existing Expectation", { exact: true })
      .selectOption("0");
    await page
      .getByLabel("Multi Judge purpose", { exact: true })
      .selectOption("independence");
    await page
      .getByLabel("Judge 1 model", { exact: true })
      .fill("aster-sim-judge-reliable@1");
    await page
      .getByLabel("Judge 1 confidence_source", { exact: true })
      .selectOption("self_rating");
    await page
      .getByLabel("Judge 2 model", { exact: true })
      .fill("aster-sim-judge-blind@1");
    await page
      .getByLabel("Judge 2 confidence_source", { exact: true })
      .selectOption("self_rating");
    await page
      .getByLabel("Voting threshold", { exact: true })
      .selectOption("fraction");
    await page.getByLabel("Voting fraction", { exact: true }).fill("0.5");
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("Voting fraction", { exact: true }).fill("0.75");
    await apply(page);
    await page.reload();
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: attachment });
    await page
      .getByLabel("Existing Expectation", { exact: true })
      .selectOption("0");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: ".local/ui3-multi.png", fullPage: true });
    await page
      .getByLabel("Consensus method", { exact: true })
      .selectOption("confidence_weighted_mean");
    await page
      .getByLabel("min_agreement (optional)", { exact: true })
      .fill("0.8");
    await apply(page);
  });
  test("registered binding executes and Export/Apply remains unchanged with Oracle registries", async ({
    page,
  }) => {
    await open(page, "validators");
    await page
      .getByLabel("Validator kind", { exact: true })
      .selectOption("registered");
    await page
      .getByLabel("Contract attachment", { exact: true })
      .selectOption({ label: "Scenario support-behaviours/slow-response" });
    await page
      .getByLabel("Validator identifier (name@version)", { exact: true })
      .fill("ui3-range@1");
    await page
      .getByLabel("Constraint id (optional)", { exact: true })
      .fill("ui3-budget");
    await page
      .getByLabel("Constraint dimension", { exact: true })
      .selectOption("operational");
    await page.getByLabel("Target", { exact: true }).fill("duration_ms");
    await page.getByLabel("Expected (YAML)", { exact: true }).fill("null");
    await apply(page);
    const batch = await page.request.post(
      "/api/projects/aster-support/executions",
      {
        data: { suite: "support-behaviours", environment: "local-simulation" },
      },
    );
    expect(batch.status()).toBe(201);
    const run = (await batch.json()).executions.find(
      (e: any) => e.scenario === "slow-response",
    );
    const results = await (
      await page.request.get(
        `/api/projects/aster-support/executions/${run.id}/results?limit=100`,
      )
    ).json();
    expect(
      results.some(
        (r: any) => r.clause === "ui3-budget" && r.oracle_type === "validator",
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "YAML editor", exact: true }).click();
    await page
      .getByRole("button", { name: "Export engine configuration", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("0 engine calls");
    await page
      .getByRole("button", { name: "Confirm Export", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Export (complete|no changes)/ }),
    ).toBeVisible();
    await review(page);
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("0 changed or created resources · 0 engine calls");
  });
});
