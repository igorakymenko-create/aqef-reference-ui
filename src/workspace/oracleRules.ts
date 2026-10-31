import type { Data, Resource } from "./model";
export const VALIDATOR_RULE =
  "Volume XV / Volume V: a Validator MUST be deterministic and MUST NOT carry a Confidence value. A model deciding pass/fail is configuring a Judge.";
export const PURPOSE_RULE =
  "Volume XV / Volume VI / Appendix A.7: Multi Judge MUST declare an explicit purpose: independence or stability.";
export const INDEPENDENCE_RULE =
  "Volume I, Chapter 3 — Independent Oracles: “An Oracle MUST NOT be the same system, weights, or decision process as the AI system it evaluates”.";
export const NEW_JUDGE_WARNING =
  "New Judge configuration: a changed model, prompt or criteria is a different Judge. Earlier Admission for a different configuration no longer applies (Volume VI — Admission).";
export const PURE_OPERATIONS = [
  "equals",
  "range",
  "schema",
  "forbidden-content",
  "structural",
];
export const BUILTINS = [
  "schema",
  "structural",
  "forbidden-content",
  "latency",
  "cost",
];
export function judgeMembers(clause: Data): Data[] {
  if (clause.judge && typeof clause.judge === "object") return [clause.judge];
  const panel = clause.multi_judge;
  if (panel?.purpose === "independence" && Array.isArray(panel.judges))
    return panel.judges;
  return panel?.judge ? [panel.judge] : [];
}
export function judgeIdentity(judge: Data, criteria: string) {
  // Exact documented http-judge-v1 identity. A threshold is not an Oracle input.
  return JSON.stringify({
    confidence_source: judge.confidence_source,
    criteria,
    model: judge.model,
    type: "judge",
    version: "http-judge-v1",
  });
}
export function modelFamily(model: string) {
  return model
    .toLowerCase()
    .split("@")[0]
    .replace(/[-_:](?:subject|judge)(?:[-_:].*)?$/, "")
    .replace(/[-_:](?:\d{4}[-_]\d{2}[-_]\d{2}|v\d+)$/, "");
}
function confidence(value: Data) {
  return Object.keys(value).some((key) =>
    ["confidence", "confidencethreshold", "confidencesource"].includes(
      key.toLowerCase().replaceAll("_", ""),
    ),
  );
}
export function contractsIn(root: Data): { scope: string; value: Data }[] {
  const output: { scope: string; value: Data }[] = [];
  const add = (scope: string, values: any) => {
    if (Array.isArray(values))
      values.forEach((value, index) => {
        if (value && typeof value === "object")
          output.push({
            scope: `${scope}/contracts/${value.name ?? index}`,
            value,
          });
      });
  };
  add("Project", root.contracts);
  for (const suite of root.suites ?? []) {
    add(`Suite/${suite.name}`, suite.contracts);
    for (const scenario of suite.scenarios ?? [])
      if (scenario.contract && typeof scenario.contract === "object")
        output.push({
          scope: `Scenario/${suite.name}/${scenario.name}`,
          value: scenario.contract,
        });
  }
  return output;
}
export function oracleChecks(
  roots: Map<string, Data>,
  resources: Resource[],
  providers: Record<string, string> = {},
) {
  const blocks: string[] = [],
    warnings: string[] = [];
  const mapped = (value: unknown) =>
    typeof value === "string" && Object.hasOwn(providers, value);
  const checkContract = (project: string, scope: string, contract: Data) => {
    const subjects = (roots.get(project)?.environments ?? []).map(
      (e: Data) => e.model_version,
    );
    for (const clause of contract.constraints ?? []) {
      if (confidence(clause))
        blocks.push(`${project}/${scope}: ${VALIDATOR_RULE}`);
      if ([clause.validator, clause.model, clause.model_version].some(mapped))
        blocks.push(
          `${project}/${scope}: ${VALIDATOR_RULE} Identifier is a mapped model provider; open Judge Configuration.`,
        );
    }
    for (const clause of contract.expectations ?? []) {
      if (
        clause.multi_judge &&
        !["independence", "stability"].includes(clause.multi_judge.purpose)
      )
        blocks.push(`${project}/${scope}: ${PURPOSE_RULE}`);
      const members = judgeMembers(clause);
      if (clause.multi_judge?.purpose === "independence") {
        const identities = members.map((member) =>
          judgeIdentity(member, clause.criteria),
        );
        if (new Set(identities).size !== identities.length)
          blocks.push(
            `${project}/${scope}: Volume VI / A.7 independence requires distinct Judge configurations; duplicate members are refused.`,
          );
      }
      for (const judge of members) {
        if (subjects.includes(judge.model))
          blocks.push(
            `${project}/${scope}: ${INDEPENDENCE_RULE} Judge model ${judge.model} equals a subject model_version.`,
          );
        else if (
          subjects.some(
            (subject: string) =>
              modelFamily(subject) === modelFamily(judge.model ?? ""),
          )
        )
          warnings.push(
            `${project}/${scope}: SHOULD NOT share the subject's model family; correlated blind spots are possible. Family match is a documented identifier heuristic, not verified provider metadata.`,
          );
      }
    }
  };
  for (const [project, root] of roots)
    for (const entry of contractsIn(root))
      checkContract(project, entry.scope, entry.value);
  for (const resource of resources) {
    if (resource.type === "Contract")
      checkContract(
        resource.project,
        resource.value.name ?? resource.path,
        resource.value,
      );
    if (resource.type === "Validator") {
      const value = resource.value;
      if (confidence(value) || (value.rule && confidence(value.rule)))
        blocks.push(`${resource.project}/${resource.path}: ${VALIDATOR_RULE}`);
      if (
        [
          value.name,
          `${value.name}@${value.version}`,
          value.model,
          value.model_version,
          value.rule?.model,
          value.rule?.model_version,
        ].some(mapped)
      )
        blocks.push(
          `${resource.project}/${resource.path}: ${VALIDATOR_RULE} Identifier is a mapped model provider; open Judge Configuration.`,
        );
      if (!PURE_OPERATIONS.includes(value.rule?.operation))
        blocks.push(
          `${resource.project}/${resource.path}: ${VALIDATOR_RULE} Only the engine's closed deterministic rule language is registrable.`,
        );
    }
  }
  return { blocks: [...new Set(blocks)], warnings: [...new Set(warnings)] };
}
export function judgeChangeWarnings(
  before: Data | null,
  after: Data,
): string[] {
  if (!before) return [];
  const identities = (root: Data) =>
    new Set(
      contractsIn(root).flatMap(({ scope, value }) =>
        (value.expectations ?? []).flatMap((clause: Data, index: number) =>
          judgeMembers(clause).map(
            (judge) =>
              `${scope}/${clause.id ?? index}/${judgeIdentity(judge, clause.criteria)}`,
          ),
        ),
      ),
    );
  const old = identities(before),
    next = identities(after);
  return [...next].some((identity) => !old.has(identity))
    ? [NEW_JUDGE_WARNING]
    : [];
}
