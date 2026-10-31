import {
  collection,
  projectPath,
  executionPath,
  type RecordData,
} from "../runs/api";
export async function controlData(project: string) {
  const executions = await collection<RecordData>(
    projectPath(project) + "/executions",
  );
  const controlBatches = new Set(
    executions
      .filter((e) => e.seeded_control_results?.length)
      .map((e) => e.execution_batch_id),
  );
  const rows = await Promise.all(
    executions
      .filter((e) => controlBatches.has(e.execution_batch_id))
      .map(async (execution) => ({
        execution,
        results: await collection<RecordData>(
          executionPath(project, execution.id) + "/results",
        ),
      })),
  );
  const controls = new Map<string, RecordData>(),
    results = new Map<string, RecordData>();
  for (const entry of rows) {
    for (const c of entry.execution.seeded_control_results ?? [])
      controls.set(c.id, { ...c, execution: entry.execution.id });
    for (const result of entry.results) {
      results.set(result.id, { result, execution: entry.execution });
      for (const member of result.supporting_evidence?.member_results ?? [])
        results.set(member.id, { result: member, execution: entry.execution });
    }
  }
  return { executions, controls: [...controls.values()], results };
}
