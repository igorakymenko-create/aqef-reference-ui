import createClient from "openapi-fetch";
import type { components, paths } from "./generated/engine";

export type Project = components["schemas"]["Project"];
export type Suite = components["schemas"]["Suite"];
export type Scenario = components["schemas"]["Scenario"];
export type Execution = {
  id: string;
  suite: string;
  scenario: string;
  environment: string;
  created_at: string;
  status: string;
  [key: string]: unknown;
};
export type Result = {
  id: string;
  clause: string;
  oracle_type: string;
  oracle: string;
  resolves?: string;
  recorded_at: string;
  disposition: string;
  verdict: string | null;
  confidence?: number | string;
  invalidated_by?: {scenario:string;defect_class:string}[];
  [key: string]: unknown;
};
export type Baseline = {
  id: string;
  suite: string;
  scenario: string;
  environment: string;
  recorded_at: string;
  [key: string]: unknown;
};
export class EngineError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}\n${body}`);
  }
}
const client = createClient<paths>({ baseUrl: "/api" });
client.use({
  async onResponse({ response }) {
    if (!response.ok)
      throw new EngineError(response.status, await response.clone().text());
  },
});

async function pages<T>(
  fetchPage: (offset: number) => Promise<unknown>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const data = await fetchPage(offset);
    if (!Array.isArray(data))
      throw new Error("Unexpected engine response: expected a paginated list");
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
export const projects = () =>
  pages<Project>(
    async (offset) =>
      (
        await client.GET("/projects", {
          params: { query: { offset, limit: 100 } },
        })
      ).data,
  );
// These response bodies are untyped objects in the engine's OpenAPI. Narrow view
// types above document consumed fields without claiming a complete runtime schema.
export const executions = (project: string) =>
  pages<Execution>(
    async (offset) =>
      (
        await client.GET("/projects/{project}/executions", {
          params: { path: { project }, query: { offset, limit: 100 } },
        })
      ).data,
  );
export const baselines = (project: string) =>
  pages<Baseline>(
    async (offset) =>
      (
        await client.GET("/projects/{project}/baselines", {
          params: { path: { project }, query: { offset, limit: 100 } },
        })
      ).data,
  );
export const results = (project: string, execution: string) =>
  pages<Result>(
    async (offset) =>
      (
        await client.GET("/projects/{project}/executions/{execution}/results", {
          params: {
            path: { project, execution },
            query: { offset, limit: 100 },
          },
        })
      ).data,
  );
export async function providers(): Promise<Record<string, string>> {
  const response = await fetch("/providers.json", { cache: "no-store" });
  if (!response.ok)
    throw new Error(`Provider mapping: HTTP ${response.status}`);
  return response.json();
}
export async function providerHealth(
  model: string,
): Promise<"available" | "unavailable" | "unknown"> {
  try {
    const response = await fetch(`/sim/health/${encodeURIComponent(model)}`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    const data = await response.json();
    if (data.model !== model) return "unknown";
    return response.ok && data.status === "available"
      ? "available"
      : data.status === "unavailable"
        ? "unavailable"
        : "unknown";
  } catch {
    return "unknown";
  }
}
