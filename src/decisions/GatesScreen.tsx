import { useEffect, useState } from "react";
import { projects as readProjects } from "../api";
import {
  localPerson,
  request,
  projectPath,
  type RecordData,
} from "../runs/api";
import { Failure, Raw } from "../runs/ExecutionView";
import { SelectField, InputField } from "../workspace/OracleFields";
import { GateCards } from "./GateCards";
import { EvaluationEvidence } from "./Evidence";
import {
  G8,
  checkGates,
  evaluations,
  loadDecisions,
  rememberEvaluation,
  rememberOverride,
  routeLink,
  segments,
  type Decisions,
} from "./api";

export function GatesScreen({ route }: { route: string }) {
  const parts = segments(route);
  const [projects, setProjects] = useState<RecordData[]>([]),
    [project, setProject] = useState(parts[1] ?? ""),
    [batch, setBatch] = useState(parts[2] ?? ""),
    [data, setData] = useState<Decisions>(),
    [selected, setSelected] = useState(parts[3] ?? ""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [target, setTarget] = useState<{ name: string; gate: RecordData }>(),
    [justification, setJustification] = useState(""),
    [showEvidence, setShowEvidence] = useState(parts[4] === "results"),
    [person, setPerson] = useState<RecordData>();
  useEffect(() => {
    readProjects()
      .then((rows) => {
        setProjects(rows);
        if (!project)
          setProject(
            rows.find((r) => r.name === "aster-support-decisions")?.name ??
              rows.find((r) => !r.name.startsWith("admission-"))?.name ??
              "",
          );
      })
      .catch(setError);
    localPerson().then(setPerson).catch(setError);
  }, []);
  useEffect(() => {
    if (!project) return;
    let active = true;
    setBusy(true);
    setError(undefined);
    setData(undefined);
    setSelected(parts[1] === project ? (parts[3] ?? "") : "");
    setTarget(undefined);
    loadDecisions(project)
      .then((records) => {
        if (active) setData(records);
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
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const history = data
    ? evaluations(project, data).filter((e) => e.batch === batch)
    : [];
  const view = history.find((e) => e.snapshot === selected) ?? history.at(-1);
  const latest = Boolean(view && view.snapshot === history.at(-1)?.snapshot);
  const batches = new Map<string, RecordData>();
  for (const execution of data?.executions ?? [])
    batches.set(execution.execution_batch_id, execution);
  async function evaluate() {
    await act(async () => {
      const response = await checkGates(project, batch);
      rememberEvaluation(project, response, batches.get(batch)!);
      setSelected(response.snapshot_id);
      setTarget(undefined);
      setShowEvidence(false);
      setData(await loadDecisions(project));
      setNotice("Engine recorded evaluation " + response.id);
    });
  }
  async function report() {
    await act(async () => {
      const response = await request(projectPath(project) + "/reports", {
        execution_batch_id: batch,
      });
      location.hash = routeLink("report", project, response.id).slice(1);
    });
  }
  async function override() {
    await act(async () => {
      if (!target || !justification.trim()) return;
      const response = await request(
        `${projectPath(project)}/gates/${encodeURIComponent(target.name)}/override`,
        {
          gate_result_id: target.gate.id,
          execution_batch_id: batch,
          justification: justification.trim(),
        },
      );
      rememberOverride(project, response);
      setTarget(undefined);
      setJustification("");
      setData(await loadDecisions(project));
      setNotice("Engine recorded override Approval " + response.approval_id);
    });
  }
  useEffect(() => {
    if (showEvidence)
      document.getElementById("evaluation-evidence")?.scrollIntoView();
  }, [showEvidence, view?.snapshot]);
  useEffect(() => {
    if (target) document.getElementById("override-form")?.scrollIntoView();
  }, [target]);
  return (
    <div className="decision-page trust-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-10 / QUALITY GATES</p>
          <h1>Gates</h1>
          <p>
            Gate decisions come first. Every value, Basis and reason below is
            returned by the engine.
          </p>
        </div>
        <a href={routeLink("reports", project)}>Reports →</a>
      </div>
      {Boolean(error) && <Failure error={error} />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className="run-control" aria-label="Gate evaluation controls">
        <SelectField
          label="Gates Project"
          value={project}
          choices={projects.map((p) => p.name)}
          onChange={(value) => {
            setProject(value);
            setBatch("");
            setNotice("");
            setShowEvidence(false);
          }}
        />
        <SelectField
          label="Execution batch"
          value={batch}
          choices={[...batches]
            .reverse()
            .map(([id, e]) => [id, `${e.suite} · ${e.environment} · ${id}`])}
          onChange={(value) => {
            setBatch(value);
            setSelected("");
            setTarget(undefined);
            setShowEvidence(false);
            setNotice("");
          }}
        />
        <p>
          The engine evaluates <strong>every applicable Gate</strong> for this
          whole batch. A subset cannot be selected.
        </p>
        <div className="button-row">
          <button
            className="primary"
            disabled={busy || !batch}
            onClick={() => void evaluate()}
          >
            Evaluate all applicable Gates
          </button>
          <button disabled={busy || !batch} onClick={() => void report()}>
            Generate frozen Report
          </button>
          <a href={routeLink("releases", project, batch)}>Release Decision →</a>
        </div>
        {busy && <p aria-live="polite">Waiting for the engine…</p>}
      </section>
      {view ? (
        <>
          <header className="evaluation-heading">
            <h2>Evaluation · Snapshot {view.snapshot}</h2>
            <p>
              {view.timeKind}: {view.at ?? "not returned"} · batch {view.batch}
            </p>
            <p>
              Suites: {view.suites.join(", ")} · Environments:{" "}
              {view.environments.join(", ")}
            </p>
            {view.response ? (
              <details>
                <summary>Complete engine evaluation response</summary>
                <Raw value={view.response} />
              </details>
            ) : (
              <p>
                Gate copy from Report {view.sourceReport}. The full evaluation
                response was not returned by this API.
              </p>
            )}
          </header>
          <GateCards
            project={project}
            gates={view.gates}
            view={view}
            data={data}
            latest={latest}
            onEvidence={() => setShowEvidence(true)}
            onOverride={(name, gate) => {
              setTarget({ name, gate });
              setJustification("");
            }}
          />
        </>
      ) : (
        <p>
          No stored Gate evaluation has been returned for this batch. Evaluate
          all Gates to obtain one.
        </p>
      )}
      {target && view && latest && (
        <section
          id="override-form"
          className="override-form designer-form"
          aria-label="Override form"
        >
          <h2>Override exactly one GateResult</h2>
          <p>
            <strong>
              This override covers this GateResult only. A new evaluation will
              not inherit it.
            </strong>
          </p>
          <dl>
            <dt>Gate</dt>
            <dd>{target.name}</dd>
            <dt>GateResult id</dt>
            <dd>{target.gate.id}</dd>
            <dt>Batch</dt>
            <dd>{batch}</dd>
          </dl>
          <p>
            Requesting Person: {person?.id ?? "not returned"}. The engine checks
            gate_override and the Gate's override_requires permission, and
            records the Approval and Role.
          </p>
          <InputField
            label="Override justification"
            value={justification}
            onChange={setJustification}
            rows={3}
          />
          <button
            className="primary"
            disabled={busy || !justification.trim()}
            onClick={() => void override()}
          >
            Record this GateResult override
          </button>
        </section>
      )}
      {showEvidence && view && data && (
        <div id="evaluation-evidence">
          <EvaluationEvidence
            project={project}
            view={view}
            executions={data.executions}
          />
        </div>
      )}
      <section aria-label="Evaluation history">
        <h2>Known evaluation history</h2>
        <p className="notice">{G8}</p>
        <ol className="evaluation-history">
          {history.map((e) => (
            <li key={e.snapshot}>
              <button
                onClick={() => {
                  setSelected(e.snapshot);
                  setTarget(undefined);
                  setShowEvidence(false);
                }}
              >
                {e.timeKind}: {e.at ?? "not returned"} · Snapshot {e.snapshot}
              </button>
              <p>
                Batch {e.batch}
                {e.sourceReport
                  ? ` · copied by Report ${e.sourceReport}`
                  : " · engine evaluation response"}
              </p>
            </li>
          ))}
        </ol>
        {!history.length && (
          <p>No evaluation history returned for this selection.</p>
        )}
      </section>
    </div>
  );
}
