import { EngineError, type Execution, type Result } from "../api";
export type RecordData = Record<string, any>;
export async function request(path: string, body?: unknown): Promise<any> {
  const response = await fetch(path, {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok)
    throw new EngineError(response.status, await response.text());
  return response.json();
}
export async function collection<T>(
  path: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== ""),
      ),
      offset: String(offset),
      limit: "100",
    });
    const page = await request(path + "?" + query);
    if (!Array.isArray(page))
      throw new Error("Engine did not return a collection");
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
export const projectPath = (project: string) =>
  "/api/projects/" + encodeURIComponent(project);
export const executionPath = (project: string, id: string) =>
  projectPath(project) + "/executions/" + encodeURIComponent(id);
export const executionLink = (project: string, id: string) =>
  "#runs/" + encodeURIComponent(project) + "/" + encodeURIComponent(id);
export type Batch = {
  execution_batch_id: string;
  executions: Execution[];
  warnings: unknown[];
};
export type Person = {
  id: string;
  kind: string;
  roles: string[];
  permissions: string[];
};
export async function localPerson(): Promise<Person> {
  const identity = await request("/person.json");
  const roles = await collection<RecordData>("/api/roles");
  return {
    ...identity,
    permissions: [
      ...new Set(
        roles
          .filter((r) => identity.roles.includes(r.name))
          .flatMap((r) => r.permissions),
      ),
    ],
  };
}
export function chains(results: Result[]): Result[][] {
  const byId = new Map(results.map((r) => [r.id, r]));
  const predecessors = new Set(results.map((r) => r.resolves).filter(Boolean));
  const tips = results.filter((r) => !predecessors.has(r.id));
  const covered = new Set<string>();
  const output: Result[][] = [];
  for (const tip of tips) {
    const chain: Result[] = [],
      seen = new Set<string>();
    let current: Result | undefined = tip;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      covered.add(current.id);
      chain.unshift(current);
      current = current.resolves ? byId.get(current.resolves) : undefined;
    }
    output.push(chain);
  }
  // Preserve even malformed or incomplete historical records, without guessing links.
  for (const row of results) if (!covered.has(row.id)) output.push([row]);
  return output;
}
