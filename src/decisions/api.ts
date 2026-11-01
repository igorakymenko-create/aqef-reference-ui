import { collection, request, projectPath, type RecordData } from "../runs/api";

export const LIVE_INTERVAL = 5000;
export const G8 =
  "G-8: the engine has no GET collection for stored Gate evaluations. This view shows evaluation responses observed here and Gate copies in saved Reports; unreported evaluations from another session are unavailable.";
export const G9 =
  "G-9: the engine returns evaluation-wide result_ids, not per-Gate membership or per-Result staleness flags. No contributing subset or staleness is inferred by the UI.";
export const segments = (route: string) =>
  route.split("/").map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
export const routeLink = (page: string, ...values: string[]) =>
  "#" + [page, ...values.map(encodeURIComponent)].join("/");
export const resultLink = (project: string, id: string, batch = "") =>
  routeLink("result", project, id, batch);

export type Evaluation = {
  snapshot: string;
  batch: string;
  suites: string[];
  environments: string[];
  gates?: RecordData;
  at?: string;
  timeKind: "evaluated_at" | "captured_at";
  resultIds?: string[];
  response?: RecordData;
  sourceReport?: string;
};
const observed = new Map<string, Evaluation[]>();
const acceptedOverrides = new Map<string, RecordData[]>();
export function rememberEvaluation(
  project: string,
  response: RecordData,
  execution: RecordData,
) {
  const view: Evaluation = {
    snapshot: response.snapshot_id,
    batch: response.execution_batch_id,
    suites: [execution.suite],
    environments: [execution.environment],
    gates: response.gates,
    at: response.evaluated_at,
    timeKind: "evaluated_at",
    resultIds: response.result_ids,
    response,
  };
  observed.set(project, [...(observed.get(project) ?? []), view]);
  return view;
}
export function rememberOverride(project: string, record: RecordData) {
  acceptedOverrides.set(project, [
    ...(acceptedOverrides.get(project) ?? []),
    record,
  ]);
}
export async function loadDecisions(project: string) {
  const root = projectPath(project);
  const [executions, reports, snapshots, approvals, admissions] =
    await Promise.all([
      collection<RecordData>(root + "/executions"),
      collection<RecordData>(root + "/reports"),
      collection<RecordData>(root + "/snapshots"),
      collection<RecordData>(root + "/approvals"),
      collection<RecordData>(root + "/admissions"),
    ]);
  return { executions, reports, snapshots, approvals, admissions };
}
export type Decisions = Awaited<ReturnType<typeof loadDecisions>>;
export function evaluations(project: string, data: Decisions): Evaluation[] {
  const records = new Map<string, Evaluation>();
  // Reports are engine-owned frozen copies, not reconstructions of an evaluation.
  for (const report of data.reports) {
    if (!report.snapshot_id) continue;
    const snapshot = data.snapshots.find((s) => s.id === report.snapshot_id);
    records.set(report.snapshot_id, {
      snapshot: report.snapshot_id,
      batch: report.scope.execution_batch_ids[0],
      suites: report.scope.suites,
      environments: report.scope.environments,
      gates: report.gates,
      at: snapshot?.captured_at,
      timeKind: "captured_at",
      sourceReport: report.id,
    });
  }
  for (const view of observed.get(project) ?? [])
    records.set(view.snapshot, view);
  return [...records.values()].sort((a, b) =>
    (a.at ?? "").localeCompare(b.at ?? ""),
  );
}
export function overrideFor(
  project: string,
  gate: RecordData,
  data?: Decisions,
): RecordData | undefined {
  const accepted = (acceptedOverrides.get(project) ?? []).find(
    (r) => r.id === gate.id,
  );
  if (accepted) return accepted;
  const approval = data?.approvals.find(
    (r) =>
      r.action === "gate_override" &&
      r.status === "approved" &&
      r.target_resource === gate.id,
  );
  if (approval)
    return {
      approval_id: approval.id,
      approved_by: approval.approved_by,
      approval_created_at: approval.created_at,
      justification: approval.details?.justification,
      approval_record: approval,
    };
  return gate.override ? { approval_id: gate.override } : undefined;
}
export async function resultRecords(
  project: string,
  executions: RecordData[],
  batch: string,
) {
  const entries = executions.filter((e) => e.execution_batch_id === batch);
  const rows = await Promise.all(
    entries.map(async (e) => ({
      execution: e,
      results: await collection<RecordData>(
        `${projectPath(project)}/executions/${encodeURIComponent(e.id)}/results`,
      ),
    })),
  );
  return rows.flatMap(({ execution, results }) =>
    results.flatMap((result) => [
      { execution, result },
      ...(result.supporting_evidence?.member_results ?? []).map(
        (member: RecordData) => ({ execution, result: member }),
      ),
    ]),
  );
}
export async function locateResult(
  project: string,
  id: string,
  batch?: string,
) {
  const executions = await collection<RecordData>(
    projectPath(project) + "/executions",
  );
  const selected = batch
    ? executions.filter((e) => e.execution_batch_id === batch)
    : executions;
  for (const execution of selected) {
    const rows = await collection<RecordData>(
      `${projectPath(project)}/executions/${encodeURIComponent(execution.id)}/results`,
    );
    if (
      rows.some(
        (r) =>
          r.id === id ||
          r.supporting_evidence?.member_results?.some(
            (m: RecordData) => m.id === id,
          ),
      )
    )
      return execution;
  }
  throw new Error("The engine did not return Result " + id + " in this scope.");
}
export async function latestResults(
  project: string,
  executions: RecordData[],
  suite: string,
  environment: string,
) {
  const newest = new Map<string, RecordData>();
  for (const row of [...executions].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )) {
    if (
      row.suite !== suite ||
      row.environment !== environment ||
      row.configuration?.scenario?.seeded_control
    )
      continue;
    const key = row.suite + "/" + row.scenario;
    if (!newest.has(key)) newest.set(key, row);
  }
  return Promise.all(
    [...newest.values()].map(async (execution) => ({
      execution,
      results: await collection<RecordData>(
        `${projectPath(project)}/executions/${encodeURIComponent(execution.id)}/results`,
      ),
    })),
  );
}
export const checkGates = (project: string, batch: string) =>
  request(projectPath(project) + "/gates/check", { execution_batch_id: batch });
