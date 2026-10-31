import { parseAllDocuments, stringify } from "yaml";
import Ajv from "ajv";
import schema from "../schema/authoring.json" with { type: "json" };
import { createTwoFilesPatch } from "diff";

export type Data = Record<string, any>;
export type Source = { path: string; content: string; etag: string | null };
export type Resource = {
  type: string;
  project: string;
  suite?: string;
  value: Data;
  path: string;
};
export const yamlText = (value: unknown) =>
  stringify(value, { lineWidth: 100 });
export const diffText = (before: string, after: string) =>
  createTwoFilesPatch("before.yaml", "after.yaml", before, after);
export function secretKeys(text: string) {
  const fallback =
    /(?:^\s*(?:-\s*)?|[,{]\s*)["']?(?:password|api_key|token|secret)["']?\s*:/im.test(
      text,
    );
  const seen = new WeakSet<object>();
  const scan = (value: any): boolean => {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    return Object.entries(value).some(
      ([key, child]) =>
        /^(password|api_key|token|secret)$/i.test(key) || scan(child),
    );
  };
  try {
    const documents = parseAllDocuments(text, { uniqueKeys: true });
    for (const document of documents)
      if (scan(document.toJS({ maxAliasCount: 100 }))) return true;
    return documents.some((document) => document.errors.length)
      ? fallback
      : false;
  } catch {
    return fallback;
  }
}
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  useDefaults: false,
  coerceTypes: false,
});
ajv.addSchema(schema);
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
function check(type: string, value: unknown): string[] {
  let validate = validators.get(type);
  if (!validate) {
    validate = ajv.compile({ $ref: `${schema.$id}#/definitions/${type}` });
    validators.set(type, validate);
  }
  validate(value);
  return (validate.errors ?? []).map(
    (error) => `${type}${error.instancePath || "/"}: ${error.message}`,
  );
}
export function parseSource(source: Source): {
  resources: Resource[];
  issues: string[];
  documents: Data[];
} {
  if (secretKeys(source.content))
    throw new Error(
      "Sensitive key detected. Use secret_ref; draft content and diff are hidden.",
    );
  const parsed = parseAllDocuments(source.content, { uniqueKeys: true });
  const resources: Resource[] = [],
    issues: string[] = [],
    documents: Data[] = [];
  for (const document of parsed) {
    if (document.errors.length)
      throw new Error(
        `${source.path}: invalid YAML syntax (no source values echoed)`,
      );
    const data = document.toJS({ maxAliasCount: 100 }) as Data;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error(`${source.path}: expected a YAML document mapping`);
    // Recursively reject secret keys even with quoted/flow YAML and aliases.
    const seen = new WeakSet<object>();
    const scan = (value: any) => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      for (const [key, child] of Object.entries(value)) {
        if (/^(password|api_key|token|secret)$/i.test(key))
          throw new Error(
            "Sensitive key detected. Use secret_ref; draft content and diff are hidden.",
          );
        scan(child);
      }
    };
    scan(data);
    try {
      JSON.stringify(data);
    } catch {
      throw new Error(
        `${source.path}: cyclic YAML aliases cannot be sent as JSON`,
      );
    }
    documents.push(data);
    if (data.items && data.labelled_by && data.name && data.version) continue; // Reference Set: auxiliary, not AQEF configuration.
    if (data.project && typeof data.project === "object") {
      resources.push({
        type: "Project",
        project: data.project.name,
        value: data.project,
        path: source.path,
      });
      // Full assembled Project is checked below; separate Suite/Scenario documents may contribute.
      continue;
    }
    if (typeof data.project !== "string" || !data.project)
      throw new Error(
        `${source.path}: document needs project: <definition or owner name>`,
      );
    const kinds: Record<string, string> = {
      contract: "Contract",
      dataset: "Dataset",
      environment: "Environment",
      suite: "Suite",
      scenario: "Scenario",
      quality_gate: "QualityGate",
      validator: "CustomValidator",
    };
    const key = Object.keys(kinds).find(
      (key) => data[key] && typeof data[key] === "object",
    );
    if (!key) throw new Error(`${source.path}: unsupported resource wrapper`);
    if (key === "scenario" && typeof data.suite !== "string")
      throw new Error(
        `${source.path}: a Scenario document needs its Suite name`,
      );
    resources.push({
      type: kinds[key] === "CustomValidator" ? "Validator" : kinds[key],
      project: data.project,
      suite: typeof data.suite === "string" ? data.suite : undefined,
      value: data[key],
      path: source.path,
    });
    issues.push(
      ...check(kinds[key], data[key]).map(
        (issue) => `${source.path}: ${issue}`,
      ),
    );
  }
  return { resources, issues, documents };
}

export function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
// Compare only documented engine defaults. Never materialize these in authored YAML.
export function normalized(type: string, value: any): any {
  if (!value || typeof value !== "object") return value;
  const data = structuredClone(value);
  const arrays: Record<string, string[]> = {
    Project: [
      "suites",
      "datasets",
      "defect_classes",
      "contracts",
      "quality_gates",
    ],
    Suite: ["contracts", "quality_gates"],
    Contract: ["constraints", "expectations", "extends"],
  };
  for (const key of arrays[type] ?? []) if (!(key in data)) data[key] = [];
  const map = (key: string, childType: string) => {
    if (Array.isArray(data[key]))
      data[key] = data[key].map((v: Data) => normalized(childType, v));
  };
  const fallback = (object: Data, key: string, value: any) => {
    if (!(key in object)) object[key] = value;
  };
  if (type === "Project") {
    map("environments", "Environment");
    map("suites", "Suite");
    map("datasets", "Dataset");
  }
  if (type === "Suite") map("scenarios", "Scenario");
  if (type === "Project" || type === "Suite") {
    if (Array.isArray(data.contracts))
      data.contracts = data.contracts.map((v: Data | string) =>
        typeof v === "string" ? v : normalized("Contract", v),
      );
    map("quality_gates", "QualityGate");
  }
  if (type === "Scenario" && typeof data.contract === "object")
    data.contract = normalized("Contract", data.contract);
  if (type === "Contract") {
    map("constraints", "Constraint");
    map("expectations", "Expectation");
    if (data.policies) fallback(data.policies, "validator_composition", "AND");
  }
  if (type === "Constraint") {
    fallback(data, "veto", false);
    const dimensions: Record<string, string> = {
      schema: "functional",
      "tool-call": "functional",
      structural: "functional",
      latency: "operational",
      cost: "operational",
      "forbidden-content": "safety",
      boundary: "safety",
    };
    if (dimensions[data.validator])
      fallback(data, "dimension", dimensions[data.validator]);
  }
  if (type === "Expectation") {
    fallback(data, "dimension", "semantic");
    fallback(data, "on_timeout", "block");
    if (data.human_reviewer)
      fallback(data.human_reviewer, "captures_confidence", false);
    if (data.multi_judge?.consensus) {
      fallback(data.multi_judge.consensus, "on_disagreement", "human_review");
      if (data.multi_judge.consensus.method === "voting")
        fallback(data.multi_judge.consensus, "threshold", "majority");
    }
  }
  if (type === "QualityGate") fallback(data, "require_admitted_judges", false);
  // Execution omission carries Project/Suite inheritance and must stay distinct
  // from an explicitly authored value, including the runtime global default.
  return data;
}
export const equal = (type: string, a: any, b: any) =>
  canonical(normalized(type, a)) === canonical(normalized(type, b));
export function assemble(sources: Source[]) {
  const parsed = sources.map(parseSource);
  const resources = parsed.flatMap((p) => p.resources);
  const unique = new Map<string, Resource>();
  for (const r of resources.filter((r) => r.type !== "Project")) {
    const key = `${r.project}/${r.type}/${r.suite ?? ""}/${r.value.name}@${r.value.version ?? ""}`;
    const previous = unique.get(key);
    if (previous && !equal(r.type, previous.value, r.value))
      throw new Error(`Conflicting ${r.type} definitions for ${r.value.name}`);
    unique.set(key, r);
  }
  const roots = new Map<string, Data>();
  for (const r of resources.filter((r) => r.type === "Project")) {
    if (!r.project || roots.has(r.project))
      throw new Error(`Duplicate or unnamed Project definition in ${r.path}`);
    roots.set(r.project, structuredClone(r.value));
  }
  function add(list: Data[], value: Data, type: string) {
    const found = list.find((v) => v.name === value.name);
    if (found && !equal(type, found, value))
      throw new Error(
        `Conflicting ${type} definitions for ${value.name}; no source silently wins`,
      );
    if (!found) list.push(structuredClone(value));
  }
  for (const r of resources.filter(
    (r) =>
      !["Project", "Contract", "Dataset", "Scenario", "Validator"].includes(
        r.type,
      ),
  )) {
    const root = roots.get(r.project);
    if (!root) throw new Error(`Missing Project document: ${r.project}`);
    const field = {
      Environment: "environments",
      Suite: "suites",
      QualityGate: "quality_gates",
    }[r.type as "Suite"];
    add((root[field] ??= []), r.value, r.type);
  }
  for (const r of resources.filter((r) => r.type === "Scenario")) {
    const suite = roots
      .get(r.project)
      ?.suites?.find((s: Data) => s.name === r.suite);
    if (!suite)
      throw new Error(`Missing Suite ${r.suite} in Project ${r.project}`);
    add((suite.scenarios ??= []), r.value, "Scenario");
  }
  for (const r of resources)
    if (!roots.has(r.project))
      throw new Error(`Missing Project document: ${r.project}`);
  for (const r of unique.values())
    if (["Contract", "Dataset"].includes(r.type)) {
      const values =
        roots.get(r.project)![
          r.type === "Contract" ? "contracts" : "datasets"
        ] ?? [];
      const inline = values.find(
        (value: Data | string) =>
          typeof value !== "string" &&
          value.name === r.value.name &&
          (r.type !== "Dataset" || value.version === r.value.version),
      );
      if (inline && !equal(r.type, inline, r.value))
        throw new Error(
          `Conflicting inline and scoped ${r.type} ${r.value.name}; no source silently wins`,
        );
    }
  const issues = [
    ...parsed.flatMap((p) => p.issues),
    ...[...roots].flatMap(([name, value]) =>
      check("Project", value).map((issue) => `${name}: ${issue}`),
    ),
  ];
  return { roots, resources, issues };
}
