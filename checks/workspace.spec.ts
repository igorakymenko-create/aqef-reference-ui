import { test, expect, type Page } from "@playwright/test";
import { parse, stringify } from "yaml";

async function editor(page: Page, content: string) {
  await page.getByTestId("yaml-editor").fill(content);
}
async function apply(page: Page) {
  await page
    .getByRole("button", { name: "Review & Apply", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Apply preview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm Apply", exact: true })
    .click();
}
test.describe.serial("UI-2 independent authoring requirements", () => {
  test("form and YAML authorship have identical fields and engine-resolved Contracts", async ({
    page,
  }) => {
    await page.goto("/#designer");
    await expect(
      page.getByRole("button", { name: "project.yaml", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Suite", { exact: true })
      .selectOption("support-behaviours");
    await page
      .getByLabel("Scenario name", { exact: true })
      .fill("authored-visually");
    await page
      .getByLabel("Prompt template", { exact: true })
      .fill("{{question}}");
    await page
      .getByLabel("Variables / Dataset binding", { exact: true })
      .selectOption("variables");
    await page
      .getByLabel("Variables (YAML mapping)", { exact: true })
      .fill("sim_case: grounded\nquestion: What is my $49 refund?\n");
    await page
      .getByLabel("Contract source", { exact: true })
      .selectOption("inline");
    await page
      .getByRole("button", { name: "Add Constraint", exact: true })
      .click();
    await page
      .getByLabel("Clause 1 id", { exact: true })
      .fill("equivalence-schema");
    await page
      .getByLabel("Clause 1 dimension", { exact: true })
      .selectOption("functional");
    await page
      .getByLabel("Clause 1 Validator", { exact: true })
      .selectOption("schema");
    await page.getByLabel("Clause 1 target", { exact: true }).fill("response");
    await page
      .getByLabel("Clause 1 expected", { exact: true })
      .fill("type: string\nminLength: 1");
    await page
      .getByRole("button", { name: "Add Expectation", exact: true })
      .click();
    await page
      .getByLabel("Clause 2 id", { exact: true })
      .fill("equivalence-grounding");
    await page
      .getByLabel("Clause 2 dimension", { exact: true })
      .selectOption("semantic");
    await page
      .getByLabel("Clause 2 criteria", { exact: true })
      .fill("[grounding] Claims must be grounded in retrieved context.");
    await page
      .getByLabel("Clause 2 Judge model", { exact: true })
      .fill("aster-sim-judge-reliable@1");
    await page
      .getByLabel("Clause 2 Confidence source", { exact: true })
      .selectOption("self_rating");
    await page
      .getByLabel("Clause 2 Confidence threshold", { exact: true })
      .fill("0.8");
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "authored-visually",
    );
    expect(
      (
        await page.request.get(
          "/api/projects/aster-support/suites/support-behaviours/scenarios/authored-visually",
        )
      ).status(),
    ).toBe(404);
    await page.screenshot({ path: ".local/ui2-designer.png", fullPage: true });
    await apply(page);
    await expect(
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    const saved = await (
      await page.request.get("/workspace/files?path=project.yaml")
    ).json();
    const doc = parse(saved.content);
    const visual = doc.project.suites[0].scenarios.find(
      (s: any) => s.name === "authored-visually",
    );
    doc.project.suites[0].scenarios.push({
      ...visual,
      name: "authored-in-yaml",
    });
    await page.getByRole("link", { name: "YAML editor", exact: true }).click();
    await editor(page, stringify(doc));
    await apply(page);
    await expect(
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    const first = await (
      await page.request.get(
        "/api/projects/aster-support/suites/support-behaviours/scenarios/authored-visually",
      )
    ).json();
    const second = await (
      await page.request.get(
        "/api/projects/aster-support/suites/support-behaviours/scenarios/authored-in-yaml",
      )
    ).json();
    const { name: firstName, ...firstFields } = first,
      { name: secondName, ...secondFields } = second;
    expect(firstName).toBe("authored-visually");
    expect(secondName).toBe("authored-in-yaml");
    expect(firstFields).toEqual(secondFields); // Every field, including all author-supplied fields.
    const run = await page.request.post(
      "/api/projects/aster-support/executions",
      {
        data: { suite: "support-behaviours", environment: "local-simulation" },
      },
    );
    expect(run.status()).toBe(201);
    const batch = await run.json();
    const a = batch.executions.find((e: any) => e.scenario === firstName);
    const b = batch.executions.find((e: any) => e.scenario === secondName);
    expect(a.status).toBe("completed");
    expect(b.status).toBe("completed");
    expect(a.configuration.contract).toEqual(b.configuration.contract); // Effective Contract from the engine, never computed by the UI.
    expect(
      a.configuration.contract.constraints.some(
        (c: any) => c.id === "equivalence-schema",
      ),
    ).toBe(true);
    expect(
      a.configuration.contract.expectations.some(
        (c: any) => c.id === "equivalence-grounding",
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/ui2-authorship.png",
      fullPage: true,
    });
  });

  test("Export then Apply is unchanged and requires no engine writes", async ({
    page,
  }) => {
    await page.goto("/#workspace");
    await expect(
      page.getByRole("button", { name: "project.yaml", exact: true }),
    ).toBeVisible();
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
      page.getByRole("heading", { name: "Export no changes", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Review & Apply", exact: true })
      .click();
    const preview = page.getByRole("region", { name: "Apply preview" });
    await expect(preview).toContainText(
      "0 changed or created resources · 0 engine calls",
    );
    await page
      .getByRole("button", { name: "Confirm Apply", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Apply no changes", exact: true }),
    ).toBeVisible();
  });

  test("real engine rejection after a reusable call is partial and verbatim", async ({
    page,
  }) => {
    const original = (
      await (
        await page.request.get("/workspace/files?path=project.yaml")
      ).json()
    ).content;
    const extra = {
      project: "aster-support",
      contract: {
        name: "partial-apply-resource",
        constraints: [
          {
            id: "partial-shape",
            validator: "schema",
            target: "response",
            expected: { type: "string" },
          },
        ],
      },
    };
    const created = await page.request.put(
      "/workspace/files?path=partial-resource.yaml",
      { data: { content: stringify(extra), expected_etag: null } },
    );
    expect(created.status()).toBe(200);
    await page.goto("/#workspace");
    await page
      .getByRole("button", { name: "project.yaml", exact: true })
      .click();
    const invalid = parse(original);
    const scenario = invalid.project.suites[0].scenarios[1];
    delete scenario.variables;
    scenario.dataset = "unregistered-dataset@1";
    await editor(page, stringify(invalid));
    await page
      .getByRole("button", { name: "Review & Apply", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("POST /api/projects/aster-support/contracts");
    const rejection = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/projects/aster-support") &&
        response.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Confirm Apply", exact: true })
      .click();
    const response = await rejection;
    expect(response.status()).toBe(422);
    await expect(
      page.getByRole("heading", { name: "Apply partial", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(await response.text());
    expect(
      (
        await page.request.get(
          "/api/projects/aster-support/contracts/partial-apply-resource",
        )
      ).status(),
    ).toBe(200);
    await page.screenshot({
      path: ".local/ui2-partial-apply.png",
      fullPage: true,
    });
    // Repair via the same editor/Apply path. No database rollback or hidden fix.
    await editor(page, original);
    await apply(page);
    await expect(
      page.getByRole("heading", { name: /Apply (complete|no changes)/ }),
    ).toBeVisible();
  });

  test("new Project Apply orders namespace, Dataset versions and reusable Contract parents", async ({
    page,
  }) => {
    const row = {
      id: "one",
      variables: { sim_case: "grounded", question: "What is my $49 refund?" },
    };
    const documents = {
      "dependency/root.yaml": {
        project: {
          name: "dependency-order",
          environments: [
            {
              name: "local",
              model_version: "aster-sim-subject@1",
              prompt_version: "p1",
              tool_configuration: null,
              infra_target: "local",
            },
          ],
          datasets: [
            { name: "base", version: "1", source: "static", rows: [row] },
          ],
          contracts: [
            {
              name: "child-contract",
              extends: ["parent-contract"],
              constraints: [
                {
                  id: "child-shape",
                  validator: "schema",
                  target: "response",
                  expected: { type: "string", minLength: 1 },
                },
              ],
            },
          ],
          suites: [
            {
              name: "dependent-suite",
              scenarios: [
                {
                  name: "dependent-scenario",
                  prompt: { template: "{{question}}" },
                  dataset: "derived@1",
                },
              ],
            },
          ],
        },
      },
      "dependency/contract.yaml": {
        project: "dependency-order",
        contract: {
          name: "parent-contract",
          constraints: [
            {
              id: "parent-shape",
              validator: "schema",
              target: "response",
              expected: { type: "string" },
            },
          ],
        },
      },
      "dependency/dataset.yaml": {
        project: "dependency-order",
        dataset: {
          name: "derived",
          version: "1",
          source: "static",
          base_dataset: "base@1",
          rows: [row],
        },
      },
    };
    for (const [path, data] of Object.entries(documents))
      expect(
        (
          await page.request.put(
            "/workspace/files?path=" + encodeURIComponent(path),
            { data: { content: stringify(data), expected_etag: null } },
          )
        ).status(),
      ).toBe(200);
    await page.goto("/#workspace");
    await expect(page.getByTestId("yaml-editor")).toBeVisible();
    await page
      .getByRole("button", { name: "Review & Apply", exact: true })
      .click();
    const preview = page.getByRole("region", { name: "Apply preview" });
    await expect(preview).toContainText("Create Project namespace");
    const requests: { path: string; body: any }[] = [];
    page.on("request", (request) => {
      if (
        ["POST", "PUT"].includes(request.method()) &&
        request.url().includes("/api/")
      )
        requests.push({
          path: new URL(request.url()).pathname,
          body: request.postDataJSON(),
        });
    });
    await page
      .getByRole("button", { name: "Confirm Apply", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    const namespace = requests.findIndex(
      (r) => r.path === "/api/projects" && r.body.name === "dependency-order",
    );
    const base = requests.findIndex(
      (r) => r.path.endsWith("/datasets") && r.body.name === "base",
    );
    const derived = requests.findIndex(
      (r) => r.path.endsWith("/datasets") && r.body.name === "derived",
    );
    const parent = requests.findIndex(
      (r) => r.path.endsWith("/contracts") && r.body.name === "parent-contract",
    );
    const child = requests.findIndex(
      (r) => r.path.endsWith("/contracts") && r.body.name === "child-contract",
    );
    const final = requests.findIndex(
      (r) => r.path === "/api/projects/dependency-order",
    );
    expect(namespace).toBeGreaterThanOrEqual(0);
    expect(base).toBeGreaterThan(namespace);
    expect(derived).toBeGreaterThan(base);
    expect(parent).toBeGreaterThan(namespace);
    expect(child).toBeGreaterThan(parent);
    expect(final).toBeGreaterThan(child);
    expect(final).toBeGreaterThan(derived);
    const accepted = await page.request.get("/api/projects/dependency-order");
    expect(accepted.status()).toBe(200);
    expect((await accepted.json()).suites[0].scenarios[0].dataset).toBe(
      "derived@1",
    );
    await page
      .getByRole("button", { name: "Export engine configuration", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Export", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Export no changes", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Review & Apply", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Apply preview" }),
    ).toContainText("0 changed or created resources · 0 engine calls");
  });

  test("secret values never reach save, preview or engine requests", async ({
    page,
  }) => {
    await page.goto("/#workspace");
    await expect(page.getByTestId("yaml-editor")).toBeVisible();
    const sent: string[] = [];
    page.on("request", (request) => {
      if (["PUT", "POST"].includes(request.method()))
        sent.push(request.postData() ?? "");
    });
    await editor(page, "project:\n  password: hidden-private-value\n");
    await expect(page.getByRole("alert")).toContainText(
      "Sensitive draft hidden",
    );
    await expect(
      page.getByText("hidden-private-value", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review & Apply", exact: true }),
    ).toBeDisabled();
    expect(sent.some((value) => value.includes("hidden-private-value"))).toBe(
      false,
    );
    const rejected = await page.request.put(
      "/workspace/files?path=secrets.yaml",
      {
        data: {
          content: "nested: {API_KEY: hidden-private-value}",
          expected_etag: null,
        },
      },
    );
    expect(rejected.status()).toBe(422);
    expect(await rejected.text()).toContain("secret_ref");
    expect(
      (
        await page.request.get("/workspace/files?path=..%2Fescape.yaml")
      ).status(),
    ).toBe(400);
  });
});
