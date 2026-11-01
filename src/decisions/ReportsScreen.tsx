import { useEffect, useState } from "react";
import { projects as readProjects } from "../api";
import { collection, projectPath, request, type RecordData } from "../runs/api";
import { Failure, Raw } from "../runs/ExecutionView";
import { SelectField } from "../workspace/OracleFields";
import { GateCards, Value } from "./GateCards";
import { oracleName } from "../format";
import { resultLink, routeLink, segments } from "./api";

export const signalKeys = [
  "retries",
  "low_confidence",
  "multi_judge",
  "unenforced_boundaries",
  "boundary_attempts",
  "unadmitted_judges",
];
function Signal({
  name,
  items,
  project,
  batch,
}: {
  name: string;
  items: unknown;
  project: string;
  batch: string;
}) {
  return (
    <section className="report-signal" aria-label={`Signal ${name}`}>
      <h3>{name}</h3>
      {(name === "unenforced_boundaries" || name === "boundary_attempts") && (
        <p className="risk-label">
          At Risk in 1.0-CR1 · recorded boundary information only
        </p>
      )}
      {!Array.isArray(items) ? (
        <p>List not returned by the engine.</p>
      ) : !items.length ? (
        <p className="empty-record">none</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              {name === "retries" ? (
                <p>
                  Scenario {item.scenario ?? "not returned"}: retries{" "}
                  {String(item.retries ?? "not returned")}
                </p>
              ) : name === "low_confidence" ? (
                <p>
                  Scenario {item.scenario ?? "not returned"} · inconclusive{" "}
                  {String(item.inconclusive ?? "not returned")} / Results{" "}
                  {String(item.results ?? "not returned")} · Oracle{" "}
                  {oracleName(item.oracle)}
                </p>
              ) : name === "multi_judge" ? (
                <p>
                  Clause {item.clause ?? "not returned"} · purpose{" "}
                  {item.purpose ?? "not returned"}
                </p>
              ) : name === "unenforced_boundaries" ? (
                <p>
                  Environment{" "}
                  {typeof item === "string" ? item : JSON.stringify(item)}
                </p>
              ) : name === "boundary_attempts" ? (
                <p>
                  Execution {item.execution ?? "not returned"} · target{" "}
                  {item.target ?? "not returned"} · blocked{" "}
                  {String(item.blocked ?? "not returned")} · tripwire{" "}
                  {String(item.tripwire ?? "not returned")}
                </p>
              ) : (
                <p>
                  Unadmitted configuration as copied at generation:{" "}
                  <code>{oracleName(item)}</code>
                </p>
              )}
              {item?.result_id && (
                <a href={resultLink(project, item.result_id, batch)}>
                  Result Evidence →
                </a>
              )}
              <details>
                <summary>Recorded signal</summary>
                <Raw value={item} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function ReportDocument({ route }: { route: string }) {
  const [, project, id] = segments(route),
    [report, setReport] = useState<RecordData>(),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    let active = true;
    setReport(undefined);
    setError(undefined);
    // A frozen document has one data source: itself. No shared live reader is mounted.
    request(`${projectPath(project)}/reports/${encodeURIComponent(id)}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [project, id]);
  const batch = report?.scope?.execution_batch_ids?.[0] ?? "";
  return (
    <div className="report-shell">
      <header className="frozen-banner" data-testid="frozen-marker">
        <strong>
          Frozen Report — generated at{" "}
          {report?.generated_at ?? "not returned yet"}
        </strong>
        <nav>
          <a href={routeLink("gates", project, batch)}>Gates</a>
          <a href={routeLink("reports", project)}>Report library</a>
          <a
            href={routeLink(
              "dashboard",
              project,
              report?.scope?.suites?.[0] ?? "",
              report?.scope?.environments?.[0] ?? "",
            )}
          >
            Dashboard →
          </a>
        </nav>
      </header>
      <article className="report-document" data-testid="frozen-report">
        {error ? (
          <Failure error={error} />
        ) : !report ? (
          <p role="status">Reading this frozen document…</p>
        ) : (
          <>
            <p className="document-kicker">
              AQEF / POINT-IN-TIME DECISION EVIDENCE
            </p>
            <h1>Report</h1>
            <p className="report-id">{report.id}</p>
            <p className="immutable-note">
              Current state may differ; this Report does not change.{" "}
              <a
                href={routeLink(
                  "dashboard",
                  project,
                  report.scope?.suites?.[0] ?? "",
                  report.scope?.environments?.[0] ?? "",
                )}
              >
                Open the Dashboard.
              </a>
            </p>
            <section aria-label="Report scope">
              <h2>Scope and Snapshot</h2>
              <dl>
                <dt>Project</dt>
                <dd>{report.scope?.project ?? "not returned"}</dd>
                <dt>Suites</dt>
                <dd>{report.scope?.suites?.join(", ") ?? "not returned"}</dd>
                <dt>Environments</dt>
                <dd>
                  {report.scope?.environments?.join(", ") ?? "not returned"}
                </dd>
                <dt>Batch IDs</dt>
                <dd>
                  {report.scope?.execution_batch_ids?.join(", ") ??
                    "not returned"}
                </dd>
                <dt>Snapshot</dt>
                <dd>{report.snapshot_id ?? "not returned"}</dd>
              </dl>
            </section>
            <h2>Gate decisions at generation</h2>
            <GateCards
              project={project}
              gates={report.gates}
              frozen
              onEvidence={() => {
                location.hash = routeLink(
                  "gates",
                  project,
                  batch,
                  report.snapshot_id,
                  "results",
                ).slice(1);
              }}
            />
            <section aria-label="Report Metrics">
              <h2>Metrics and their Evidence</h2>
              {!Array.isArray(report.metrics) ? (
                <p>Metrics list not returned by the engine.</p>
              ) : !report.metrics.length ? (
                <p>none</p>
              ) : (
                report.metrics.map((metric: RecordData, index: number) => (
                  <section
                    className="report-metric"
                    key={index}
                    aria-label={`Metric ${metric.name}`}
                  >
                    <h3>{metric.name}</h3>
                    <p>{metric.definition ?? "Definition not returned"}</p>
                    <Value
                      value={metric.value}
                      onEvidence={() => {
                        location.hash = routeLink(
                          "metric",
                          project,
                          report.id,
                          String(index),
                        ).slice(1);
                      }}
                    />
                    <h4>Result IDs supplied by the engine</h4>
                    {Array.isArray(metric.result_ids) ? (
                      metric.result_ids.length ? (
                        <ul>
                          {metric.result_ids.map((key: string) => (
                            <li key={key}>
                              <a href={resultLink(project, key, batch)}>
                                {key} · Evidence →
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>none</p>
                      )
                    ) : (
                      <p>Result IDs not returned.</p>
                    )}
                    <details>
                      <summary>Show engine record</summary>
                      <Raw value={metric} />
                    </details>
                  </section>
                ))
              )}
            </section>
            <section aria-label="Report signals">
              <h2>All six signal lists</h2>
              {signalKeys.map((key) => (
                <Signal
                  key={key}
                  name={key}
                  items={report.signals?.[key]}
                  project={project}
                  batch={batch}
                />
              ))}
            </section>
            <details>
              <summary>Complete frozen engine Report</summary>
              <Raw value={report} />
            </details>
          </>
        )}
      </article>
    </div>
  );
}
export function ReportsScreen({ route }: { route: string }) {
  const parts = segments(route),
    [projects, setProjects] = useState<RecordData[]>([]),
    [project, setProject] = useState(parts[1] ?? ""),
    [reports, setReports] = useState<RecordData[]>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    readProjects()
      .then((rows) => {
        setProjects(rows);
        if (!project)
          setProject(
            rows.find((p) => p.name === "aster-support-decisions")?.name ??
              rows[0]?.name ??
              "",
          );
      })
      .catch(setError);
  }, []);
  useEffect(() => {
    if (!project) return;
    let active = true;
    setBusy(true);
    setReports([]);
    setError(undefined);
    collection<RecordData>(projectPath(project) + "/reports")
      .then((rows) => {
        if (active) setReports(rows);
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
  }, [project]);
  return (
    <section className="decision-page trust-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-10 / FROZEN DOCUMENT LIBRARY</p>
          <h1>Reports</h1>
        </div>
        <a href={routeLink("gates", project)}>
          Generate from a batch in Gates →
        </a>
      </div>
      <SelectField
        label="Reports Project"
        value={project}
        choices={projects.map((p) => p.name)}
        onChange={setProject}
      />
      {Boolean(error) && <Failure error={error} />}
      {busy ? (
        <p role="status">Reading saved Reports…</p>
      ) : (
        <ul className="report-library">
          {reports.map((report) => (
            <li key={report.id}>
              <a href={routeLink("report", project, report.id)}>
                <strong>Report {report.id}</strong>
              </a>
              <p>
                Frozen at {report.generated_at} · Snapshot{" "}
                {report.snapshot_id ?? "not returned"}
              </p>
              <p>
                Suites {report.scope?.suites?.join(", ") ?? "not returned"} ·
                Environments{" "}
                {report.scope?.environments?.join(", ") ?? "not returned"}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!busy && !reports.length && <p>No Reports returned by the engine.</p>}
    </section>
  );
}
