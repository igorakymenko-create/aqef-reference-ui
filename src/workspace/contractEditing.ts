import { parseAllDocuments, type Document } from "yaml";
import type { Data } from "./model";
export type Target = {
  label: string;
  project: string;
  document: number;
  path: (string | number)[];
  contract: Data;
};
export function contractTargets(content: string): Target[] {
  try {
    const documents = parseAllDocuments(content, { uniqueKeys: true });
    if (documents.some((d) => d.errors.length)) return [];
    const targets: Target[] = [];
    documents.forEach((doc, document) => {
      const data = doc.toJS(),
        root = data?.project;
      if (!data || !root) return;
      const project = typeof root === "object" ? root.name : root;
      const add = (label: string, path: Target["path"], contract: Data) =>
        targets.push({ label, project, document, path, contract });
      const list = (label: string, path: Target["path"], contracts: any[]) => {
        (contracts ?? []).forEach((c, index) => {
          if (c && typeof c === "object")
            add(
              `${label} · ${c.name ?? `inline ${index + 1}`}`,
              [...path, index],
              c,
            );
        });
        add(
          `${label} · new inline Contract`,
          [...path, contracts?.length ?? 0],
          {},
        );
      };
      const suite = (value: Data, path: Target["path"]) => {
        list(`Suite ${value.name}`, [...path, "contracts"], value.contracts);
        (value.scenarios ?? []).forEach((s: Data, index: number) => {
          if (typeof s.contract !== "string")
            add(
              `Scenario ${value.name}/${s.name}`,
              [...path, "scenarios", index, "contract"],
              s.contract ?? {},
            );
        });
      };
      if (typeof root === "object") {
        list("Project", ["project", "contracts"], root.contracts);
        (root.suites ?? []).forEach((s: Data, index: number) =>
          suite(s, ["project", "suites", index]),
        );
      }
      if (data.contract && typeof data.contract === "object")
        add(
          `Reusable Contract ${data.contract.name}`,
          ["contract"],
          data.contract,
        );
      if (data.suite && typeof data.suite === "object")
        suite(data.suite, ["suite"]);
      if (data.scenario && typeof data.scenario.contract !== "string")
        add(
          `Scenario ${data.suite}/${data.scenario.name}`,
          ["scenario", "contract"],
          data.scenario.contract ?? {},
        );
    });
    return targets;
  } catch {
    return [];
  }
}
export function editContract(content: string, target: Target, contract: Data) {
  const documents = parseAllDocuments(content, { uniqueKeys: true });
  const doc = documents[target.document];
  if (
    typeof target.path.at(-1) === "number" &&
    !doc.getIn(target.path.slice(0, -1))
  )
    doc.setIn(target.path.slice(0, -1), []);
  doc.setIn(target.path, contract);
  return documents
    .map((d) => d.toString({ lineWidth: 100 }).replace(/^---\s*\n/, ""))
    .join("\n---\n");
}
export function appendValidator(
  content: string,
  project: string,
  definition: Data,
) {
  const documents: Document[] = parseAllDocuments(content, {
    uniqueKeys: true,
  });
  const existing = documents.find((doc) => {
    const data = doc.toJS();
    return (
      data?.project === project &&
      data.validator?.name === definition.name &&
      data.validator?.version === definition.version
    );
  });
  if (existing) existing.set("validator", definition);
  else {
    const doc = parseAllDocuments("project: placeholder\nvalidator: {}\n")[0];
    doc.set("project", project);
    doc.set("validator", definition);
    documents.push(doc);
  }
  return documents
    .map((d) => d.toString({ lineWidth: 100 }).replace(/^---\s*\n/, ""))
    .join("\n---\n");
}
