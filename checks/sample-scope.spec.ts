import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
const scoped: Record<string, string[]> = {
  "grounded-refund": ["grounding", "retrieval"],
  "unsupported-claim": ["grounding"],
  "retrieval-miss": ["retrieval"],
  "claimed-completion": ["completion"],
  "wrong-tool-argument": ["tool-argument"],
  "correct-refusal": ["correct-refusal"],
  "over-refusal": ["over-refusal"],
  "slow-response": [],
  "approximate-amount": ["grounding"],
  "recoverable-outage": ["grounding"],
  "human-signoff": ["human-signoff"],
  "panel-disagreement": ["grounding"],
};
test("review sample scope change through shared Apply, run Suite and inspect every Judge property", async ({
  page,
}) => {
  const sample = parse(
    readFileSync("examples/aster/project.yaml", "utf8"),
  ).project;
  const file = await (
    await page.request.get("/workspace/files?path=project.yaml")
  ).json();
  const document = parse(file.content),
    project = document.project;
  if (project?.name !== "aster-support")
    throw new Error(
      "Expected the owned Aster sample Project; no workspace file overwritten.",
    );
  const ids = new Set(Object.values(scoped).flat());
  const general = project.contracts.find(
    (contract: any) => contract.name === "support-quality",
  );
  const suite = project.suites.find(
    (s: any) => s.name === "support-behaviours",
  );
  for (const scenario of sample.suites[0].scenarios)
    if (!suite.scenarios.some((s: any) => s.name === scenario.name))
      suite.scenarios.push(scenario);
  general.expectations = (general.expectations ?? []).filter(
    (clause: any) => !ids.has(clause.id),
  );
  if (!general.expectations.length) delete general.expectations;
  for (const scenario of project.suites.find(
    (suite: any) => suite.name === "support-behaviours",
  ).scenarios) {
    if (!(scenario.name in scoped)) continue;
    if (typeof scenario.contract === "string")
      throw new Error(
        "Sample has an owner-authored Contract reference; inspect before migration.",
      );
    const contract = scenario.contract ?? {};
    const own = (contract.expectations ?? []).filter(
      (clause: any) => !ids.has(clause.id),
    );
    const desired =
      sample.suites[0].scenarios.find((s: any) => s.name === scenario.name)
        ?.contract?.expectations ?? [];
    if (own.length || desired.length)
      contract.expectations = [...own, ...desired];
    else delete contract.expectations;
    if (Object.keys(contract).length) scenario.contract = contract;
    else delete scenario.contract;
  }
  await page.goto("/#workspace");
  await expect(page.getByTestId("yaml-editor")).toBeVisible();
  await page.getByTestId("yaml-editor").fill(stringify(document));
  await page
    .getByRole("button", { name: "Review & Apply", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Apply preview" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/ui3-sample-apply-preview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm Apply", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Apply (complete|no changes)/ }),
  ).toBeVisible();
  const response = await page.request.post(
    "/api/projects/aster-support/executions",
    { data: { suite: "support-behaviours", environment: "local-simulation" } },
  );
  expect(response.status()).toBe(201);
  const batch = await response.json();
  expect(batch.executions).toHaveLength(12);
  for (const execution of batch.executions) {
    expect(execution.status).toBe("completed");
    expect(
      execution.configuration.contract.expectations
        .map((c: any) => c.id)
        .sort(),
    ).toEqual([...scoped[execution.scenario]].sort());
    const results = await (
      await page.request.get(
        `/api/projects/aster-support/executions/${execution.id}/results?limit=1000`,
      )
    ).json();
    for (const result of results.filter((r: any) => r.oracle_type === "judge"))
      expect(scoped[execution.scenario]).toContain(result.clause);
  }
});
