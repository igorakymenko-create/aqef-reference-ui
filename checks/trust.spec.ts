import { test, expect, type Page } from "@playwright/test";
import { parse, parseAllDocuments, stringify } from "yaml";
import { readFileSync } from "node:fs";
import { agreement } from "../src/trust/model";
let projectName = "aster-support",
  base = "/api/projects/aster-support";
const reference = parse(
  readFileSync("examples/aster/reference-set.yaml", "utf8"),
);
const oracle = JSON.stringify({
  confidence_source: "self_rating",
  criteria:
    "[grounding] Every amount and duration must be supported by retrieved policy.",
  model: "aster-sim-judge-reliable@1",
  type: "judge",
  version: "http-judge-v1",
});
let plan: any,
  originalBatch: any,
  admissionsBefore = 0,
  qualifiedOracle = "",
  freshKeys: string[] = [];
async function sourcePlan(page: Page) {
  const names = (await (await page.request.get("/workspace/files")).json())
    .files;
  const files = await Promise.all(
    names
      .filter((s: string) => s.startsWith("admissions/plans/"))
      .map(
        async (path: string) =>
          parse(
            (
              await (
                await page.request.get(
                  "/workspace/files?path=" + encodeURIComponent(path),
                )
              ).json()
            ).content,
          ).admission_plan,
      ),
  );
  return files
    .filter((p: any) => p.project === projectName)
    .sort((a: any, b: any) => a.declared_at.localeCompare(b.declared_at))
    .at(-1);
}
async function results(page: Page, id: string) {
  return await (
    await page.request.get(`${base}/executions/${id}/results?limit=1000`)
  ).json();
}
async function execute(page: Page, suite: string) {
  const response = await page.request.post(base + "/executions", {
    data: { suite, environment: "local-simulation" },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function resume(page: Page) {
  await page.goto("/#admission");
  await page
    .getByLabel("Admission Project", { exact: true })
    .selectOption(projectName);
  await page
    .getByLabel("Resume declaration", { exact: true })
    .selectOption(plan.id);
}
async function controlsReady(page: Page) {
  await expect(
    page.getByRole("button", { name: "Refresh controls", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
}
test.describe.serial("UI-5 independent Admission and control checks", () => {
  test.setTimeout(90000);
  test("Evidence is readable first, panel is a table and frozen record is last/collapsed", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "ui-5-docker") {
      projectName = "ui5-check-" + crypto.randomUUID();
      base = "/api/projects/" + projectName;
      const definition = parse(
        readFileSync("examples/aster/project.yaml", "utf8"),
      );
      definition.project.name = projectName;
      await page.goto("/#workspace");
      await expect(page.getByTestId("yaml-editor")).toBeVisible();
      await page.evaluate(
        ({ path, content }) =>
          window.dispatchEvent(
            new CustomEvent("aqef-propose-source", {
              detail: { path, content },
            }),
          ),
        {
          path: `checks/${projectName}.yaml`,
          content: stringify(definition),
        },
      );
      await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
        projectName,
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
        page.getByRole("heading", { name: "Apply complete", exact: true }),
      ).toBeVisible();
    }
    const batch = await execute(page, "support-behaviours"),
      panel = batch.executions.find(
        (e: any) => e.scenario === "panel-disagreement",
      );
    await page.goto("/#runs/" + projectName + "/" + panel.id);
    await expect(
      page
        .getByRole("region", { name: "Recorded panel members" })
        .getByRole("table"),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Frozen configuration" })
        .locator("details")
        .first(),
    ).not.toHaveAttribute("open", "");
    expect(
      await page.evaluate(() =>
        Boolean(
          document
            .querySelector('[aria-label="Resolution chains"]')!
            .compareDocumentPosition(
              document.querySelector('[aria-label="Frozen configuration"]')!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    const engineRecord = page
      .getByRole("region", { name: "Recorded panel members" })
      .getByText("Show engine record", { exact: true })
      .first();
    await engineRecord.click();
    await expect(
      page
        .getByRole("region", { name: "Recorded panel members" })
        .locator("details[open] .json"),
    ).toContainText("provider_response");
    const approximate = batch.executions.find(
      (e: any) => e.scenario === "approximate-amount",
    );
    const record = (await results(page, approximate.id)).find(
      (r: any) => r.oracle_type === "judge",
    );
    expect(record.supporting_evidence.explanation).toContain(
      "exact amount not stated",
    );
    expect(record.supporting_evidence.explanation).toContain("$49.99");
  });
  test("threshold declaration precedes scores, exposed items excluded, generated Suite uses shared Apply and no subject", async ({
    page,
  }) => {
    admissionsBefore = (
      await (await page.request.get(base + "/admissions?limit=1000")).json()
    ).length;
    await page.goto("/#admission");
    await page
      .getByLabel("Admission Project", { exact: true })
      .selectOption(projectName);
    await page
      .getByLabel("Exact Oracle string (including historical configuration)", {
        exact: true,
      })
      .fill(oracle);
    await page
      .getByLabel("Reference Set version", { exact: true })
      .selectOption({ label: "aster-grounding@3" });
    await expect(
      page.getByText("1 exposed items excluded for this configuration.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId("kappa")).toHaveCount(0);
    await page
      .getByLabel("Chance-corrected measure", { exact: true })
      .selectOption("cohen_kappa");
    await page.getByLabel("Declared threshold", { exact: true }).fill("0.8");
    await page
      .getByRole("button", { name: "Record declaration", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Declared workflow/ }),
    ).toBeVisible();
    plan = await sourcePlan(page);
    expect(plan.declared_by).toBe("aster-local-person");
    expect(plan.results_seen).toBe(false);
    expect(plan.items).toHaveLength(25);
    await page
      .getByLabel("Diagnostic Environment", { exact: true })
      .selectOption("local-simulation");
    await page
      .getByRole("button", {
        name: "Generate Suite → Review & Apply",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Workspace", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "reference-grounding",
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
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    await resume(page);
    const before = (await (await page.request.get("/sim-control/flaky")).json())
      .subject_calls;
    await page
      .getByRole("button", { name: "Run declared Reference Set", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Compute and show agreement",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 45000 });
    expect(
      (await (await page.request.get("/sim-control/flaky")).json())
        .subject_calls,
    ).toBe(before);
    await page
      .getByRole("button", { name: "Compute and show agreement", exact: true })
      .click();
    await expect(page.getByTestId("kappa")).toHaveText("0.840");
    plan = await sourcePlan(page);
    const included = reference.items.filter((i: any) => !i.exposed),
      scores = plan.scores;
    let a = 0,
      b = 0,
      c = 0,
      d = 0;
    for (const item of included) {
      const actual = scores.find((s: any) => s.item === item.id).verdict;
      if (item.label === "pass") {
        if (actual === "pass") a++;
        else b++;
      } else if (actual === "pass") c++;
      else d++;
    }
    const n = a + b + c + d,
      po = (a + d) / n,
      pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n),
      k = (po - pe) / (1 - pe);
    expect(await page.getByTestId("kappa").textContent()).toBe(k.toFixed(3));
    expect(k).toBeGreaterThan(0.8);
    expect(k).toBeLessThan(1);
    await expect(
      page.getByRole("region", { name: "Agreement arithmetic" }),
    ).toContainText(`(${a} + ${d}) / ${n}`);
    const sent = page.waitForRequest(
      (r) => r.url().endsWith("/admissions") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Admission", exact: true })
      .click();
    const payload = (await sent).postDataJSON();
    expect(payload.chance_corrected_agreement).toBeCloseTo(k, 12);
    expect(payload.raw_agreement).toBe(po);
    expect(Object.keys(payload).sort()).toEqual(
      [
        "oracle",
        "reference_set",
        "items",
        "verdict_distribution",
        "raw_agreement",
        "measure",
        "chance_corrected_agreement",
        "threshold",
        "admitted",
        "labelled_by",
        "arbitrations",
      ].sort(),
    );
    expect(payload.raw_agreement).toBe(po);
    expect(payload.chance_corrected_agreement).toBeCloseTo(k);
    expect(payload.admitted).toBe(true);
    await expect(page.locator(".admission-record").last()).toContainText(
      "decides current status",
    );
  });
  test("later false Admission and threshold change remain visible in plan and acceptance order", async ({
    page,
  }) => {
    await resume(page);
    await page
      .getByLabel("Threshold after seeing results", { exact: true })
      .fill("1.1");
    await expect(
      page.getByText("threshold changed after results were seen", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Save threshold change to plan",
        exact: true,
      })
      .click();
    await expect
      .poll(async () =>
        Boolean((await sourcePlan(page)).threshold_changed_after_results),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Record Admission", exact: true })
      .click();
    await expect(page.locator(".admission-record")).toHaveCount(
      admissionsBefore + 2,
    );
    await expect(page.locator(".admission-record").last()).toContainText(
      "admitted: false",
    );
    await expect(page.locator(".admission-record").last()).toContainText(
      "decides current status",
    );
    await page.screenshot({ path: ".local/ui5-admission.png", fullPage: true });
    await page
      .getByRole("button", { name: "New workflow", exact: true })
      .click();
    await expect(page.getByTestId("kappa")).toHaveCount(0);
    await expect(
      page.getByText(/New Judge configuration:/).first(),
    ).toBeVisible();
  });
  test("the blind Judge disagrees on the same Reference Set and records admitted false", async ({
    page,
  }) => {
    await page.goto("/#admission");
    await page
      .getByLabel("Admission Project", { exact: true })
      .selectOption(projectName);
    const blind = JSON.stringify({
      ...JSON.parse(oracle),
      model: "aster-sim-judge-blind@1",
    });
    await page
      .getByLabel("Exact Oracle string (including historical configuration)", {
        exact: true,
      })
      .fill(blind);
    await page
      .getByLabel("Reference Set version", { exact: true })
      .selectOption({ label: "aster-grounding@3" });
    await page
      .getByLabel("Chance-corrected measure", { exact: true })
      .selectOption("cohen_kappa");
    await page.getByLabel("Declared threshold", { exact: true }).fill("0.8");
    await page
      .getByRole("button", { name: "Record declaration", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Declared workflow/ }),
    ).toBeVisible();
    plan = await sourcePlan(page);
    await page
      .getByLabel("Diagnostic Environment", { exact: true })
      .selectOption("local-simulation");
    await page
      .getByRole("button", {
        name: "Generate Suite → Review & Apply",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "reference-grounding",
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
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    await resume(page);
    await page
      .getByRole("button", { name: "Run declared Reference Set", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Compute and show agreement",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole("button", { name: "Compute and show agreement", exact: true })
      .click();
    await expect(page.getByTestId("kappa")).toHaveText("0.000");
    const table = page
      .getByRole("region", { name: "Agreement arithmetic" })
      .locator("tbody tr");
    await expect(table.nth(0)).toContainText("13");
    await expect(table.nth(1)).toContainText("13");
    const sent = page.waitForRequest(
      (r) => r.url().endsWith("/admissions") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Admission", exact: true })
      .click();
    expect((await sent).postDataJSON()).toMatchObject({
      oracle: blind,
      threshold: 0.8,
      admitted: false,
      chance_corrected_agreement: 0,
      raw_agreement: 0.5,
    });
    await expect(page.locator(".admission-record").last()).toContainText(
      "admitted: false",
    );
  });
  test("single-class labels are not_computed, missing verdicts never get fabricated agreement", () => {
    const labels = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: i < 8 ? "pass" : "fail",
    }));
    const scores = labels.map((item, i) => ({
      item: item.id,
      verdict: i < 6 || (i >= 8 && i < 11) ? "pass" : "fail",
    }));
    const calculated = agreement(labels, scores);
    expect(calculated.table).toEqual([
      [6, 2],
      [3, 9],
    ]);
    expect(calculated.kappa).toBeCloseTo(
      (15 / 20 - 204 / 400) / (1 - 204 / 400),
      12,
    );
    expect(
      agreement([{ id: "a", label: "pass" }], [{ item: "a", verdict: "pass" }])
        .kappa,
    ).toBe("not_computed");
    const missing = agreement(
      [
        { id: "a", label: "pass" },
        { id: "b", label: "fail" },
      ],
      [{ item: "a", verdict: "pass" }],
    );
    expect(missing.kappa).toBe("not_computed");
    expect(missing.raw).toBeNull();
    expect(missing.missing).toEqual(["b"]);
    expect(missing.hp + missing.hf).toBe(2);
  });
  test("control authoring proposes YAML and uses shared Apply; omitted policy stays omitted", async ({
    page,
  }) => {
    await page.goto("/#control-designer");
    await page
      .getByLabel("Control Suite", { exact: true })
      .selectOption("instrument-checks");
    await page
      .getByLabel("Control kind", { exact: true })
      .selectOption("clean");
    await page
      .getByLabel("Defect class", { exact: true })
      .fill("unsupported_claim");
    await page
      .getByLabel("Confirmed by", { exact: true })
      .selectOption("construction");
    await page
      .getByLabel("Control Evidence binding", { exact: true })
      .selectOption("fixed");
    await page
      .getByLabel("Fixed control Evidence (YAML)", { exact: true })
      .fill(stringify(reference.items[2].evidence));
    await page.getByLabel("Control Contract (YAML)", { exact: true }).fill(
      stringify({
        expectations: [
          {
            id: "authored-grounding",
            criteria: JSON.parse(oracle).criteria,
            judge: {
              model: "aster-sim-judge-reliable@1",
              confidence_source: "self_rating",
            },
            confidence_threshold: 0.8,
            defect_classes: ["unsupported_claim"],
          },
        ],
      }),
    );
    await page
      .getByLabel("Control Scenario name", { exact: true })
      .fill("authored-clean");
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "authored-clean",
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
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    const p = parseAllDocuments(
      (
        await (
          await page.request.get("/workspace/files?path=project.yaml")
        ).json()
      ).content,
    )[0].toJS();
    expect(
      p.project.suites.find((s: any) => s.name === "instrument-checks")
        .execution,
    ).toBeUndefined();
  });
  test("blind miss, overcall false alarm and unconfirmed invalid are engine records; invalidation preserves verdict", async ({
    page,
  }) => {
    originalBatch = await execute(page, "instrument-checks");
    const controls = originalBatch.executions[0].seeded_control_results;
    const defect = controls.find(
        (c: any) => c.scenario === "unsupported-defect",
      ),
      clean = controls.find((c: any) => c.scenario === "faithful-clean");
    expect(
      defect.oracles.find((o: any) =>
        JSON.parse(o.oracle).model.includes("blind"),
      ).outcome,
    ).toBe("missed");
    expect(
      clean.oracles.find((o: any) =>
        JSON.parse(o.oracle).model.includes("overcall"),
      ).outcome,
    ).toBe("false_alarm");
    expect(
      controls.find((c: any) => c.scenario === "awaiting-confirmation").outcome,
    ).toBe("invalid");
    await page.goto(
      "/#controls/" + projectName + "/" + originalBatch.execution_batch_id,
    );
    await controlsReady(page);
    await expect(
      page
        .getByText("invalid — no reason recorded by the engine", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    const confirmedClean = page.getByRole("region", {
      name: "Control faithful-clean",
      exact: true,
    });
    await expect(confirmedClean).toContainText("confirmed: true");
    await expect(confirmedClean).not.toContainText("Evidence not confirmed");
    await expect(confirmedClean).toContainText(
      "invalid — no reason recorded by the engine",
    );
    const invalidation = confirmedClean.locator("details").filter({
      has: page.locator("summary", { hasText: "Full-run invalidation" }),
    });
    await expect(invalidation).not.toHaveAttribute("open", "");
    const pending = page.getByRole("region", {
      name: "Control awaiting-confirmation",
      exact: true,
    });
    await pending
      .getByLabel("Confirmed", { exact: true })
      .selectOption("false");
    await pending
      .getByLabel("Human confirmation reason", { exact: true })
      .fill("Cannot affirm the Evidence yet.");
    await pending
      .getByRole("button", { name: "Record control confirmation", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP 422");
    await expect(pending).toContainText("invalid");
    await pending.getByLabel("Confirmed", { exact: true }).selectOption("true");
    await pending
      .getByRole("button", { name: "Record control confirmation", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Engine accepted");
    for (const name of ["blind-subject-check", "overcall-subject-check"]) {
      const e = originalBatch.executions.find((e: any) => e.scenario === name),
        row = (await results(page, e.id)).find(
          (r: any) => r.oracle_type === "judge",
        );
      expect(row.invalidated_by.length).toBeGreaterThan(0);
      await page.goto("/#runs/" + projectName + "/" + e.id);
      await expect(
        page
          .getByText(/invalidated — cannot support a release decision/)
          .first(),
      ).toBeVisible();
      // Measure a cold deep link separately from the Controls page's already
      // in-flight confirmation reload. The original navigation above still has
      // its default five-second assertion.
      const evidence = await page.context().newPage();
      try {
        const reads: string[] = [];
        evidence.on("request", (request) => {
          reads.push(new URL(request.url()).pathname);
        });
        await evidence.goto("/#runs/" + projectName + "/" + e.id);
        await expect(
          evidence
            .getByText(/invalidated — cannot support a release decision/)
            .first(),
        ).toBeVisible();
        expect(reads.filter((path) => path.endsWith("/executions"))).toEqual(
          [],
        );
        const resultReads = reads.filter((path) => path.endsWith("/results"));
        expect(resultReads.length).toBeGreaterThan(0);
        expect(
          resultReads.every(
            (path) => path === `${base}/executions/${e.id}/results`,
          ),
        ).toBe(true);
      } finally {
        await evidence.close();
      }
      expect(
        (await results(page, e.id)).find((r: any) => r.id === row.id).verdict,
      ).toBe(row.verdict);
    }
  });
  test("reused controls are refused; fresh requalification and corrected assessment add actionable links without subject calls", async ({
    page,
  }) => {
    await page.goto(
      "/#controls/" + projectName + "/" + originalBatch.execution_batch_id,
    );
    await controlsReady(page);
    const control = originalBatch.executions[0].seeded_control_results.find(
      (c: any) => c.scenario === "unsupported-defect",
    );
    const old = control.oracles.find((o: any) =>
      JSON.parse(o.oracle).model.includes("overcall"),
    );
    await page
      .getByLabel("Corrected Oracle from control Result", { exact: true })
      .selectOption(old.oracle);
    await page
      .getByLabel("Requalification defect class", { exact: true })
      .fill("unsupported_claim");
    await page
      .getByRole("checkbox", {
        name: new RegExp(
          "Qualification control unsupported-defect " + old.result_ids[0],
        ),
      })
      .check();
    await page
      .getByLabel("Diagnosis", { exact: true })
      .fill("Attempt to reuse exposed Evidence");
    await page
      .getByRole("button", { name: "Record Requalification", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("HTTP 409");
    await expect(page.getByRole("alert")).toContainText("exposed");
    const fresh = await execute(page, "fresh-instrument-checks");
    freshKeys = [];
    for (const e of fresh.executions) {
      const r = (await results(page, e.id)).find(
        (r: any) => r.oracle_type === "judge",
      );
      qualifiedOracle = r.oracle;
      freshKeys.push(r.id);
    }
    await page
      .getByRole("button", { name: "Refresh controls", exact: true })
      .click();
    await controlsReady(page);
    await page
      .getByLabel("Corrected Oracle from control Result", { exact: true })
      .selectOption(qualifiedOracle);
    await page
      .getByLabel("Diagnosis", { exact: true })
      .fill(
        "Replace the blind/overcalling configurations with reliable; fresh defect catches and clean passes.",
      );
    for (const key of freshKeys)
      await page
        .getByRole("checkbox", {
          name: new RegExp("Qualification control fresh-.* " + key),
        })
        .check();
    await page
      .getByRole("button", { name: "Record Requalification", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Engine accepted");
    const before = (await (await page.request.get("/sim-control/flaky")).json())
      .subject_calls;
    for (const name of ["blind-subject-check", "overcall-subject-check"]) {
      const e = originalBatch.executions.find((e: any) => e.scenario === name),
        original = (await results(page, e.id)).find(
          (r: any) => r.oracle_type === "judge",
        );
      await page.goto("/#runs/" + projectName + "/" + e.id);
      await page
        .getByLabel("Requalified Oracle", { exact: true })
        .selectOption(qualifiedOracle);
      await page
        .getByRole("button", {
          name: "Re-assess with the requalified Oracle",
          exact: true,
        })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Re-check recorded actionable",
      );
      const after = await results(page, e.id);
      expect(after.find((r: any) => r.id === original.id)).toEqual(original);
      expect(
        after.find((r: any) => r.resolves === original.id).disposition,
      ).toBe("actionable");
    }
    expect(
      (await (await page.request.get("/sim-control/flaky")).json())
        .subject_calls,
    ).toBe(before);
    await page.screenshot({
      path: ".local/ui5-requalified.png",
      fullPage: true,
    });
  });
  test("full-run invalidation is explicit and leaves an earlier actionable verdict unchanged", async ({
    page,
  }) => {
    const e = originalBatch.executions.find(
        (e: any) => e.scenario === "reliable-subject-check",
      ),
      before = (await results(page, e.id)).find(
        (r: any) => r.oracle_type === "judge",
      );
    expect(before.verdict).toBe("pass");
    await page.goto(
      "/#controls/" + projectName + "/" + originalBatch.execution_batch_id,
    );
    await controlsReady(page);
    const section = page.getByRole("region", {
      name: "Control unsupported-defect",
      exact: true,
    });
    await section
      .locator("summary")
      .filter({ hasText: "Full-run invalidation" })
      .click();
    await section
      .getByLabel("Full-run invalidation reason", { exact: true })
      .fill("The instrument failure compromises this whole demonstration run.");
    await section
      .getByRole("button", { name: "Invalidate full run", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Engine accepted");
    const after = (await results(page, e.id)).find(
      (r: any) => r.id === before.id,
    );
    expect(after.verdict).toBe(before.verdict);
    expect(after.invalidated_by).toContainEqual({
      scenario: "unsupported-defect",
      defect_class: "unsupported_claim",
    });
  });
  test("single-class Reference Set records not_computed and admitted false through the real workflow", async ({
    page,
  }) => {
    const single = {
      name: "single-class-demonstration",
      version: crypto.randomUUID(),
      labelled_by: ["aster-local-person"],
      items: reference.items
        .filter((i: any) => i.label === "pass" && !i.exposed)
        .slice(0, 2),
    };
    expect(
      (
        await page.request.put(
          "/workspace/files?path=checks/single-class-" +
            single.version +
            ".yaml",
          {
            data: { content: stringify(single), expected_etag: null },
          },
        )
      ).status(),
    ).toBe(200);
    await page.goto("/#admission");
    await page
      .getByLabel("Admission Project", { exact: true })
      .selectOption(projectName);
    await page
      .getByLabel("Exact Oracle string (including historical configuration)", {
        exact: true,
      })
      .fill(oracle);
    await page
      .getByLabel("Reference Set version", { exact: true })
      .selectOption({ label: single.name + "@" + single.version });
    await page
      .getByLabel("Chance-corrected measure", { exact: true })
      .selectOption("cohen_kappa");
    await page.getByLabel("Declared threshold", { exact: true }).fill("0.8");
    await page
      .getByRole("button", { name: "Record declaration", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Declared workflow/ }),
    ).toBeVisible();
    plan = await sourcePlan(page);
    await page
      .getByLabel("Diagnostic Environment", { exact: true })
      .selectOption("local-simulation");
    await page
      .getByRole("button", {
        name: "Generate Suite → Review & Apply",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("YAML diff", { exact: true })).toContainText(
      "reference-grounding",
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
      page.getByRole("heading", { name: "Apply complete", exact: true }),
    ).toBeVisible();
    await resume(page);
    await page
      .getByRole("button", { name: "Run declared Reference Set", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Compute and show agreement",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole("button", { name: "Compute and show agreement", exact: true })
      .click();
    await expect(page.getByTestId("kappa")).toHaveText("not_computed");
    const sent = page.waitForRequest(
      (r) => r.url().endsWith("/admissions") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Record Admission", exact: true })
      .click();
    const payload = (await sent).postDataJSON();
    expect(payload.chance_corrected_agreement).toBe("not_computed");
    expect(payload.admitted).toBe(false);
    await expect(page.locator(".admission-record").last()).toContainText(
      "decides current status",
    );
  });
});
