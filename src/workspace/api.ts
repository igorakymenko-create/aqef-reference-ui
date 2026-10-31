import { EngineError } from "../api";
import {
  assemble,
  canonical,
  diffText,
  equal,
  normalized,
  parseSource,
  yamlText,
  type Data,
  type Source,
} from "./model";

async function json(
  path: string,
  init?: RequestInit,
  missing = false,
): Promise<any> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (missing && response.status === 404) return null;
  if (!response.ok)
    throw new EngineError(response.status, await response.text());
  return response.json();
}
export const fileNames = async (): Promise<string[]> =>
  (await json("/workspace/files")).files;
export const readFile = (path: string): Promise<Source> =>
  json("/workspace/files?path=" + encodeURIComponent(path));
export const writeFile = (source: Source) =>
  json("/workspace/files?path=" + encodeURIComponent(source.path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: source.content,
      expected_etag: source.etag,
    }),
  });
export const readAll = async () =>
  Promise.all((await fileNames()).map(readFile));
const enc = encodeURIComponent;
async function all(path: string): Promise<Data[]> {
  const records: Data[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await json(`${path}?limit=100&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error("Expected engine collection");
    records.push(...page);
    if (page.length < 100) return records;
  }
}
export type Change = {
  resource: string;
  kind: "created" | "changed" | "unchanged";
  governed: boolean;
  diff: string;
  call: string;
};
export type Operation = {
  project: string;
  method: string;
  path: string;
  body: Data;
  governed: boolean;
  note?: string;
};
export type Plan = {
  sources: Source[];
  changes: Change[];
  operations: Operation[];
  reads: { path: string; value: any }[];
  issues: string[];
};
const projectPath = (name: string) => "/api/projects/" + enc(name);

function governed(value: Data) {
  return Boolean(
    value.contract ||
      value.contracts?.length ||
      value.quality_gates?.length ||
      value.suites?.some((s: Data) => governed(s)) ||
      value.scenarios?.some((s: Data) => governed(s)),
  );
}
function inventory(
  root: Data | null,
): Map<string, { type: string; value: Data }> {
  const map = new Map<string, { type: string; value: Data }>();
  if (!root) return map;
  const add = (key: string, type: string, value: Data) =>
    map.set(key, { type, value });
  add("Project/" + root.name, "Project", root);
  for (const env of root.environments ?? [])
    add("Environment/" + env.name, "Environment", env);
  for (const suite of root.suites ?? []) {
    add("Suite/" + suite.name, "Suite", suite);
    for (const scenario of suite.scenarios ?? [])
      add(`Scenario/${suite.name}/${scenario.name}`, "Scenario", scenario);
  }
  for (const dataset of root.datasets ?? [])
    add(`Dataset/${dataset.name}@${dataset.version}`, "Dataset", dataset);
  for (const gate of root.quality_gates ?? [])
    add("QualityGate/" + gate.name, "QualityGate", gate);
  for (const contract of root.contracts ?? [])
    if (typeof contract !== "string")
      add(
        "Attached Contract/" + (contract.name ?? "(inline)"),
        "Contract",
        contract,
      );
  return map;
}
export async function makePlan(sources: Source[]): Promise<Plan> {
  const workspace = assemble(sources);
  const changes: Change[] = [],
    operations: Operation[] = [],
    reads: Plan["reads"] = [];
  for (const [name, wanted] of workspace.roots) {
    const path = projectPath(name);
    const current = await json(path, undefined, true);
    reads.push({ path, value: current });
    const external = workspace.resources.filter(
      (r) => r.project === name && ["Contract", "Dataset"].includes(r.type),
    );
    const rootChanged = !equal("Project", current, wanted);
    const finalCall = `${current ? "PUT" : external.length ? "PUT" : "POST"} ${current || external.length ? path : "/api/projects"}`;
    const before = inventory(current),
      after = inventory(wanted);
    for (const [resource, entry] of after) {
      const previous = before.get(resource)?.value;
      const kind =
        previous === undefined
          ? "created"
          : equal(entry.type, previous, entry.value)
            ? "unchanged"
            : "changed";
      changes.push({
        resource: `${name} · ${resource}`,
        kind,
        governed:
          ["Contract", "QualityGate"].includes(entry.type) ||
          governed(entry.value),
        diff:
          kind === "unchanged"
            ? ""
            : diffText(
                previous ? yamlText(previous) : "",
                yamlText(entry.value),
              ),
        call:
          kind === "unchanged"
            ? "No write"
            : `${finalCall} (inline resource in atomic Project definition)`,
      });
    }
    for (const [resource, entry] of before)
      if (!after.has(resource))
        changes.push({
          resource: `${name} · ${resource} (removed from definition)`,
          kind: "changed",
          governed:
            ["Contract", "QualityGate"].includes(entry.type) ||
            governed(entry.value),
          diff: diffText(yamlText(entry.value), ""),
          call: finalCall,
        });
    // C.3 has no Suite PUT and requires each resulting Project to remain valid.
    // Keep inline dependencies together in the documented atomic Project operation.
    if (!current && external.length)
      operations.push({
        project: name,
        method: "POST",
        path: "/api/projects",
        body: { name, environments: wanted.environments },
        governed: false,
        note: "Create Project namespace before reusable resource calls; no Suites or Contracts are implied.",
      });
    const candidates = [...external];
    if (!current && external.length) {
      for (const dataset of wanted.datasets ?? [])
        candidates.push({
          type: "Dataset",
          project: name,
          value: dataset,
          path: "(inline Project)",
        });
      for (const contract of wanted.contracts ?? [])
        if (typeof contract === "object" && contract.name)
          candidates.push({
            type: "Contract",
            project: name,
            value: contract,
            path: "(inline Project)",
          });
    }
    const pending = [
      ...new Map(
        candidates.map((r) => [
          `${r.type}/${r.value.name}@${r.value.version ?? ""}`,
          r,
        ]),
      ).values(),
    ];
    const ordered =
      typeof pending.sort === "function"
        ? pending.sort((a, b) =>
            a.type === "Dataset" && b.type !== "Dataset"
              ? -1
              : b.type === "Dataset" && a.type !== "Dataset"
                ? 1
                : 0,
          )
        : pending;
    const done = new Set<string>();
    for (let index = 0; ordered.length; ) {
      const candidate = ordered.findIndex((r) =>
        r.type === "Dataset"
          ? !r.value.base_dataset ||
            !ordered.some(
              (other) =>
                other.type === "Dataset" &&
                `${other.value.name}@${other.value.version}` ===
                  r.value.base_dataset,
            )
          : (r.value.extends ?? []).every(
              (parent: string) =>
                !ordered.some(
                  (other) =>
                    other.type === "Contract" && other.value.name === parent,
                ),
            ),
      );
      if (candidate < 0)
        throw new Error(
          "Cyclic reusable resource dependencies; no calls issued",
        );
      const r = ordered.splice(candidate, 1)[0];
      index++;
      const collection =
        path + (r.type === "Contract" ? "/contracts" : "/datasets");
      const resourcePath =
        collection +
        "/" +
        enc(r.value.name) +
        (r.type === "Dataset" ? "?version=" + enc(r.value.version) : "");
      const old = current ? await json(resourcePath, undefined, true) : null;
      if (current) reads.push({ path: resourcePath, value: old });
      const kind =
        old === null
          ? "created"
          : equal(r.type, old, r.value)
            ? "unchanged"
            : "changed";
      const method = r.type === "Contract" && old ? "PUT" : "POST";
      const target = method === "PUT" ? resourcePath : collection;
      changes.push({
        resource: `${name} · Reusable ${r.type}/${r.value.name}${r.type === "Dataset" ? "@" + r.value.version : ""}`,
        kind,
        governed: r.type === "Contract",
        diff:
          kind === "unchanged"
            ? ""
            : diffText(old ? yamlText(old) : "", yamlText(r.value)),
        call: kind === "unchanged" ? "No write" : `${method} ${target}`,
      });
      if (kind !== "unchanged")
        operations.push({
          project: name,
          method,
          path: target,
          body: r.value,
          governed: r.type === "Contract",
          note:
            r.type === "Dataset" && old
              ? "Dataset versions are immutable; the engine will decide this request."
              : undefined,
        });
      done.add(r.value.name);
    }
    if (rootChanged)
      operations.push({
        project: name,
        method: current || external.length ? "PUT" : "POST",
        path: current || external.length ? path : "/api/projects",
        body: wanted,
        governed: governed(wanted) || Boolean(current && governed(current)),
      });
  }
  return { sources, changes, operations, reads, issues: workspace.issues };
}
export type Outcome = {
  call: string;
  status: "saved" | "success" | "failed" | "skipped";
  message: string;
};
export async function applyPlan(
  plan: Plan,
  originals: Source[],
): Promise<{ state: string; outcomes: Outcome[] }> {
  const outcomes: Outcome[] = [];
  try {
    // A preview expires if either its source files or its engine read set changed.
    const disk = await readAll();
    if (
      canonical(disk.map((s) => [s.path, s.etag]).sort()) !==
      canonical(
        originals
          .filter((s) => s.etag !== null)
          .map((s) => [s.path, s.etag])
          .sort(),
      )
    )
      throw new Error(
        "Workspace changed since preview. Reload and review a new plan.",
      );
    for (const read of plan.reads)
      if (
        canonical(await json(read.path, undefined, true)) !==
        canonical(read.value)
      )
        throw new Error(
          "Engine configuration changed since preview. Review a new plan.",
        );
    for (const source of plan.sources) {
      const original = originals.find((old) => old.path === source.path);
      if (!original || original.content !== source.content) {
        await writeFile(source);
        outcomes.push({
          call: `YAML ${source.path}`,
          status: "saved",
          message: "Source saved; engine acceptance is reported separately.",
        });
      }
    }
  } catch (error) {
    return {
      state: "failed",
      outcomes: [
        ...outcomes,
        {
          call: "Preflight / YAML save",
          status: "failed",
          message: String(error instanceof Error ? error.message : error),
        },
      ],
    };
  }
  const failedProjects = new Set<string>();
  for (const operation of plan.operations) {
    const call = `${operation.method} ${operation.path}`;
    if (failedProjects.has(operation.project)) {
      outcomes.push({
        call,
        status: "skipped",
        message: "Dependency failed for this Project; no call issued.",
      });
      continue;
    }
    try {
      await json(operation.path, {
        method: operation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation.body),
      });
      outcomes.push({
        call,
        status: "success",
        message: "Accepted by the engine.",
      });
    } catch (error) {
      failedProjects.add(operation.project);
      outcomes.push({
        call,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    state: failedProjects.size
      ? outcomes.some((o) => o.status === "success")
        ? "partial"
        : "failed"
      : plan.operations.length
        ? "complete"
        : "no changes",
    outcomes,
  };
}

export async function exportEngine(sources: Source[]): Promise<Source[]> {
  const workspace = assemble(sources),
    result = new Map(sources.map((source) => [source.path, { ...source }]));
  for (const project of await all("/api/projects"))
    if (!workspace.roots.has(project.name)) {
      const path = "exported/" + enc(project.name) + ".yaml";
      if (result.has(path))
        throw new Error(
          `Export target ${path} already exists with a different role; rename it outside the workspace and retry.`,
        );
      result.set(path, { path, content: "", etag: null });
      workspace.roots.set(project.name, project);
      workspace.resources.push({
        type: "Project",
        project: project.name,
        value: project,
        path,
      });
    }
  for (const [name] of workspace.roots) {
    const root = await json(projectPath(name));
    const contracts = await all(projectPath(name) + "/contracts");
    const datasets = await all(projectPath(name) + "/datasets");
    const projectSource = workspace.resources.find(
      (r) => r.project === name && r.type === "Project",
    )!;
    const source = result.get(projectSource.path)!;
    // Canonical exported Project contains the complete engine definition. Existing
    // split documents are updated too, so their duplicate contribution is identical.
    (source as any).exports ??= [];
    (source as any).exports.push({ project: root });
    const extra: Data[] = [];
    for (const r of workspace.resources.filter(
      (r) => r.project === name && r.type !== "Project",
    )) {
      let value: Data | undefined;
      if (r.type === "Contract")
        value = contracts.find((c) => c.name === r.value.name);
      if (r.type === "Dataset")
        value = datasets.find(
          (d) => d.name === r.value.name && d.version === r.value.version,
        );
      if (r.type === "Environment")
        value = root.environments.find((e: Data) => e.name === r.value.name);
      if (r.type === "Suite")
        value = root.suites.find((s: Data) => s.name === r.value.name);
      if (r.type === "Scenario")
        value = root.suites
          .find((s: Data) => s.name === r.suite)
          ?.scenarios.find((s: Data) => s.name === r.value.name);
      if (r.type === "QualityGate")
        value = root.quality_gates.find((g: Data) => g.name === r.value.name);
      if (!value)
        throw new Error(
          `Export cannot remove ${r.path}: workspace service has no delete operation. Move the obsolete YAML outside the workspace, then retry.`,
        );
      const key = {
        Contract: "contract",
        Dataset: "dataset",
        Environment: "environment",
        Suite: "suite",
        Scenario: "scenario",
        QualityGate: "quality_gate",
      }[r.type as "Contract"];
      const target = result.get(r.path)!;
      const document = {
        project: name,
        ...(r.suite ? { suite: r.suite } : {}),
        [key]: value,
      };
      // Scope documents are serialized together below when they share a file.
      (target as any).exports ??= [];
      (target as any).exports.push(document);
    }
    for (const contract of contracts)
      if (
        !workspace.resources.some(
          (r) =>
            r.project === name &&
            r.type === "Contract" &&
            r.value.name === contract.name,
        ) &&
        !(root.contracts ?? []).some(
          (c: Data | string) =>
            typeof c !== "string" && c.name === contract.name,
        )
      )
        extra.push({ project: name, contract });
    for (const dataset of datasets)
      if (
        !workspace.resources.some(
          (r) =>
            r.project === name &&
            r.type === "Dataset" &&
            r.value.name === dataset.name &&
            r.value.version === dataset.version,
        ) &&
        !(root.datasets ?? []).some(
          (d: Data) => d.name === dataset.name && d.version === dataset.version,
        )
      )
        extra.push({ project: name, dataset });
    if (extra.length) (source as any).exports.push(...extra);
  }
  for (const source of result.values())
    if ((source as any).exports) {
      source.content = (source as any).exports.map(yamlText).join("\n---\n");
      delete (source as any).exports;
    }
  for (const source of result.values()) parseSource(source); // Includes secret guard, before any write.
  return [...result.values()];
}
