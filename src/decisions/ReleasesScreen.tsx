import { useEffect, useState } from "react";
import { projects as readProjects } from "../api";
import { collection, request, projectPath, type RecordData } from "../runs/api";
import { Failure, Raw } from "../runs/ExecutionView";
import { SelectField, InputField } from "../workspace/OracleFields";
import { GateCards } from "./GateCards";
import { routeLink, segments } from "./api";

export function ReleasesScreen({ route }: { route: string }) {
  const parts = segments(route),
    [project, setProject] = useState(parts[1] ?? ""),
    [projects, setProjects] = useState<RecordData[]>([]),
    [reports, setReports] = useState<RecordData[]>([]),
    [releases, setReleases] = useState<RecordData[]>([]),
    [batch, setBatch] = useState(parts[2] ?? ""),
    [reportId, setReportId] = useState(""),
    [decision, setDecision] = useState(""),
    [notes, setNotes] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const report = reports.find((r) => r.id === reportId),
    batches = [
      ...new Set(reports.flatMap((r) => r.scope?.execution_batch_ids ?? [])),
    ] as string[];
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
    setError(undefined);
    setReportId("");
    setDecision("");
    Promise.all([
      collection<RecordData>(projectPath(project) + "/reports"),
      collection<RecordData>(projectPath(project) + "/releases"),
    ])
      .then(([r, h]) => {
        if (active) {
          setReports(r);
          setReleases(h);
        }
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
  async function record() {
    if (!report || !decision) return;
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const response = await request(projectPath(project) + "/releases", {
        execution_batch_id: batch,
        report_id: report.id,
        snapshot_id: report.snapshot_id,
        decision,
        notes,
      });
      setReleases(
        await collection<RecordData>(projectPath(project) + "/releases"),
      );
      setNotice("Engine recorded Release Decision " + response.id);
      setDecision("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="decision-page trust-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-10 / APPROVAL WORKFLOW</p>
          <h1>Release Decisions</h1>
        </div>
        <a href={routeLink("gates", project, batch)}>Gates →</a>
      </div>
      <p>
        The engine decides whether the submitted decision is valid. No release
        outcome is calculated here.
      </p>
      {Boolean(error) && (
        <>
          <Failure error={error} />
          <p>
            <a href={routeLink("gates", project, batch)}>
              Re-evaluate all Gates and regenerate the Report →
            </a>
          </p>
        </>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className="designer-form" aria-label="Release Decision form">
        <SelectField
          label="Release Project"
          value={project}
          choices={projects.map((p) => p.name)}
          onChange={(value) => {
            setProject(value);
            setBatch("");
            setNotice("");
          }}
        />
        <SelectField
          label="Release batch"
          value={batch}
          choices={batches}
          onChange={(value) => {
            setBatch(value);
            setReportId("");
            setDecision("");
          }}
        />
        <SelectField
          label="Report for this decision"
          value={reportId}
          choices={reports
            .filter((r) => r.scope?.execution_batch_ids?.includes(batch))
            .map((r) => [
              r.id,
              `${r.id} · Snapshot ${r.snapshot_id} · ${r.generated_at}`,
            ])}
          onChange={setReportId}
        />
        {report && (
          <>
            <p>
              Batch {batch} · Report {report.id} · Snapshot {report.snapshot_id}
            </p>
            <p>
              This is the engine's copied Gate state in the selected Report.
              Each blocking pass, overridden failure and remaining failure is
              shown individually; advisory failures remain visible. A newer
              evaluation, override or configuration may make this tuple stale.
              The engine checks it on submission.
            </p>
            <GateCards project={project} gates={report.gates} frozen />
          </>
        )}
        <SelectField
          label="Release decision (choose explicitly)"
          value={decision}
          choices={["approved", "overridden", "rejected"]}
          onChange={setDecision}
        />
        <InputField
          label="Release notes"
          value={notes}
          onChange={setNotes}
          rows={3}
        />
        <button
          className="primary"
          disabled={busy || !report || !batch || !decision}
          onClick={() => void record()}
        >
          Record Release Decision
        </button>
      </section>
      <section aria-label="Release Decision history">
        <h2>Immutable Release Decision history</h2>
        {releases.map((release) => (
          <article className="release-record" key={release.id}>
            <h3>
              {release.decision} · {release.id}
            </h3>
            <p>
              Batch {release.execution_batch_id} · Snapshot{" "}
              {release.snapshot_id} ·{" "}
              <a href={routeLink("report", project, release.report_id)}>
                Report {release.report_id}
              </a>
            </p>
            <p>
              Approval {release.approval_id} · Person {release.approved_by} ·
              Role {release.approval_role} · {release.approved_at}
            </p>
            <p>{release.notes}</p>
            <GateCards
              project={project}
              gates={release.gates}
              frozen
              recordKind="Release Decision"
            />
            <details>
              <summary>Show engine record</summary>
              <Raw value={release} />
            </details>
          </article>
        ))}
        {!busy && !releases.length && (
          <p>No Release Decisions returned by the engine.</p>
        )}
      </section>
    </section>
  );
}
