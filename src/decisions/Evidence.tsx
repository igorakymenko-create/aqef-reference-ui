import { useEffect, useState } from "react";
import type { Result } from "../api";
import { ResultEntries } from "../ResultEntries";
import { Failure } from "../runs/ExecutionView";
import {
  collection,
  request,
  projectPath,
  executionLink,
  type RecordData,
} from "../runs/api";
import { Value } from "./GateCards";
import {
  G9,
  locateResult,
  resultRecords,
  routeLink,
  segments,
  type Evaluation,
} from "./api";

export function EvaluationEvidence({
  project,
  view,
  executions,
}: {
  project: string;
  view: Evaluation;
  executions: RecordData[];
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof resultRecords>>>(
      [],
    ),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(undefined);
    setRows([]);
    if (!view.resultIds) {
      setBusy(false);
      return;
    }
    resultRecords(project, executions, view.batch)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [project, view.snapshot]);
  return (
    <section className="evaluation-evidence" aria-label="Evaluation Results">
      <h2>Results listed by this evaluation</h2>
      <p>{G9}</p>
      {view.gates &&
        Object.values(view.gates).some((g) =>
          g.reasons?.includes("stale_results"),
        ) && (
          <p className="notice stale">
            The engine recorded stale_results for this evaluation. It did not
            identify individual stale Result IDs; none are guessed here.
          </p>
        )}
      {error ? (
        <Failure error={error} />
      ) : busy ? (
        <p role="status">Reading the engine's Result records…</p>
      ) : !view.resultIds ? (
        <p>
          Evaluation-wide result_ids were not returned by the Report API. Open
          the Report for its Metric-specific evidence, or evaluate all Gates to
          obtain a full response.
        </p>
      ) : (
        <>
          <ResultEntries
            results={view.resultIds.flatMap((id) => {
              const entry = rows.find((r) => r.result.id === id);
              return entry ? [entry.result as Result] : [];
            })}
            onEvidence={(result) => {
              const entry = rows.find((r) => r.result.id === result.id);
              if (entry)
                location.hash =
                  executionLink(project, entry.execution.id).slice(1) +
                  "/" +
                  encodeURIComponent(result.id);
            }}
          />
          {view.resultIds
            .filter((id) => !rows.some((r) => r.result.id === id))
            .map((id) => (
              <p key={id}>Result {id}: no record returned by the engine.</p>
            ))}
          {view.resultIds.length === 0 && (
            <p>The engine returned an empty result_ids list.</p>
          )}
        </>
      )}
    </section>
  );
}
export function ResultLocator({ route }: { route: string }) {
  const [, project, id, batch] = segments(route),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    locateResult(project, id, batch)
      .then((execution) => {
        if (active)
          location.hash = routeLink("runs", project, execution.id, id).slice(1);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [project, id, batch]);
  return (
    <section>
      <h1>Result Evidence</h1>
      <p>Result {id}</p>
      {error ? (
        <Failure error={error} />
      ) : (
        <p role="status">
          Locating this exact Result through the engine's execution resources…
        </p>
      )}
    </section>
  );
}

export function MetricEvidence({ route }: { route: string }) {
  const [, project, reportId, index] = segments(route),
    [metric, setMetric] = useState<RecordData>(),
    [rows, setRows] = useState<Awaited<ReturnType<typeof resultRecords>>>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(undefined);
    setMetric(undefined);
    (async () => {
      const report = await request(
          `${projectPath(project)}/reports/${encodeURIComponent(reportId)}`,
        ),
        item = report.metrics?.[Number(index)];
      if (!item)
        throw new Error(
          "The engine did not return that Metric in this Report.",
        );
      const executions = await collection<RecordData>(
          projectPath(project) + "/executions",
        ),
        records = await resultRecords(
          project,
          executions,
          report.scope.execution_batch_ids[0],
        );
      if (active) {
        setMetric(item);
        setRows(records);
      }
    })()
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [project, reportId, index]);
  return (
    <section className="evaluation-evidence">
      <p className="eyebrow">ENGINE-SUPPLIED METRIC EVIDENCE</p>
      <h1>Metric Evidence</h1>
      <p>
        <a href={routeLink("report", project, reportId)}>
          Return to the frozen Report →
        </a>
      </p>
      {error ? (
        <Failure error={error} />
      ) : busy ? (
        <p role="status">Reading the Metric's supplied Result IDs…</p>
      ) : (
        metric && (
          <>
            <h2>{metric.name}</h2>
            <p>{metric.definition}</p>
            <Value value={metric.value} />
            <p>
              The Metric is the Report's copied value. The Result links below
              use only its result_ids; no Metric is recomputed.
            </p>
            <p>
              Result records are read as the engine exposes them. A pending
              Human Result can complete in place; the Report and Metric remain
              frozen.
            </p>
            <ResultEntries
              results={(metric.result_ids ?? []).flatMap((id: string) => {
                const row = rows.find((r) => r.result.id === id);
                return row ? [row.result as Result] : [];
              })}
              onEvidence={(result) => {
                const row = rows.find((r) => r.result.id === result.id);
                if (row)
                  location.hash = routeLink(
                    "runs",
                    project,
                    row.execution.id,
                    result.id,
                  ).slice(1);
              }}
            />
            {Array.isArray(metric.result_ids) ? (
              metric.result_ids.length === 0 ? (
                <p>The engine supplied no Result IDs for this Metric.</p>
              ) : (
                metric.result_ids
                  .filter((id: string) => !rows.some((r) => r.result.id === id))
                  .map((id: string) => (
                    <p key={id}>Result {id}: not returned by the engine.</p>
                  ))
              )
            ) : (
              <p>Result IDs not returned by the engine.</p>
            )}
          </>
        )
      )}
    </section>
  );
}
