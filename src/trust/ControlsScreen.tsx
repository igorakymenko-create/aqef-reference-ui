import { useEffect, useState } from "react";
import { projects as readProjects } from "../api";
import {
  collection,
  request,
  projectPath,
  executionLink,
  localPerson,
  type RecordData,
} from "../runs/api";
import { Failure, Raw } from "../runs/ExecutionView";
import { SelectField, InputField } from "../workspace/OracleFields";
import { controlData } from "./data";
export function ControlsScreen({ route }: { route: string }) {
  const parts = route.split("/"),
    [project, setProject] = useState(
      parts[1] ? decodeURIComponent(parts[1]) : "",
    ),
    [projects, setProjects] = useState<RecordData[]>([]),
    [data, setData] = useState<Awaited<ReturnType<typeof controlData>>>(),
    [batch, setBatch] = useState(parts[2] ? decodeURIComponent(parts[2]) : ""),
    [person, setPerson] = useState<RecordData>(),
    [qualifications, setQualifications] = useState<RecordData[]>([]),
    [oracle, setOracle] = useState(""),
    [defect, setDefect] = useState(""),
    [keys, setKeys] = useState<string[]>([]),
    [diagnosis, setDiagnosis] = useState(""),
    [error, setError] = useState<unknown>(),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!project) return;
    setBusy(true);
    setError(undefined);
    try {
      const [d, q, p] = await Promise.all([
        controlData(project),
        collection<RecordData>(projectPath(project) + "/requalifications"),
        localPerson(),
      ]);
      setData(d);
      setQualifications(q);
      setPerson(p);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    readProjects()
      .then((p) => {
        setProjects(p);
        if (!project)
          setProject(
            p.find((p) => !p.name.startsWith("admission-"))?.name ?? "",
          );
      })
      .catch(setError);
  }, []);
  useEffect(() => {
    void load();
  }, [project, route]);
  async function act(path: string, body: RecordData) {
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      const accepted = await request(path, body);
      setNotice("Engine accepted record " + accepted.id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const candidates = new Map<string, string>();
  for (const c of data?.controls ?? [])
    for (const o of c.oracles ?? [])
      if (["caught", "passed"].includes(o.outcome))
        candidates.set(o.oracle, o.oracle);
  const eligible = (data?.controls ?? []).filter(
    (c) => !batch || c.execution_batch_id === batch,
  );
  return (
    <div className="trust-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-9 / ENGINE CONTROL RECORDS</p>
          <h1>Seeded Controls</h1>
        </div>
        <button disabled={busy} onClick={() => void load()}>
          Refresh controls
        </button>
      </div>
      {busy && <p aria-live="polite">Loading engine control records…</p>}
      <p>
        Controls never enter quality aggregates. Outcomes, confirmation,
        invalidation and requalification acceptance are engine decisions.
      </p>
      <a href="#control-designer">Author a control Scenario over YAML →</a>
      {Boolean(error) && <Failure error={error} />}
      {notice && <p role="status">{notice}</p>}
      <SelectField
        label="Controls Project"
        value={project}
        choices={projects
          .filter((p) => !p.name.startsWith("admission-"))
          .map((p) => p.name)}
        onChange={(value) => {
          setProject(value);
          setBatch("");
          setData(undefined);
        }}
      />
      <SelectField
        label="Control batch"
        value={batch}
        omission="All batches with controls"
        choices={[
          ...new Set((data?.controls ?? []).map((c) => c.execution_batch_id)),
        ]}
        onChange={setBatch}
      />
      {eligible.map((c) => (
        <section
          className="control-record"
          key={c.id}
          id={"control-" + c.scenario}
          aria-label={`Control ${c.scenario}`}
        >
          <h2>{c.scenario}</h2>
          <p>
            Batch {c.execution_batch_id} · {c.kind} · class {c.defect_class}
          </p>
          <p
            className={`badge ${c.outcome === "invalid" ? "not_assessed" : "recorded"}`}
          >
            {c.outcome}
          </p>
          {c.outcome === "invalid" && (
            <p className="notice">
              Evidence not confirmed — no verdict about the Oracle
            </p>
          )}
          <p>
            Confirmed by {c.confirmed_by}; confirmed: {String(c.confirmed)};
            scope: {c.invalidation_scope}
          </p>
          <details>
            <summary>Confirmation and complete control record</summary>
            <Raw value={c} />
          </details>
          <table>
            <thead>
              <tr>
                <th>Exact Oracle</th>
                <th>Outcome recorded</th>
                <th>Tested Result IDs</th>
              </tr>
            </thead>
            <tbody>
              {(c.oracles ?? []).map((o: RecordData) => (
                <tr key={o.oracle}>
                  <td>
                    <details>
                      <summary>
                        {(() => {
                          try {
                            return (
                              JSON.parse(o.oracle).model ??
                              JSON.parse(o.oracle).type
                            );
                          } catch {
                            return o.oracle;
                          }
                        })()}
                      </summary>
                      <pre className="json">{o.oracle}</pre>
                    </details>
                  </td>
                  <td>
                    {o.outcome}
                    {o.outcome === "invalid" && (
                      <p>
                        Evidence not confirmed — no verdict about the Oracle
                      </p>
                    )}
                  </td>
                  <td>
                    {o.result_ids.map((key: string) => {
                      const e = data?.results.get(key);
                      return (
                        <p key={key}>
                          {e ? (
                            <a href={executionLink(project, e.execution.id)}>
                              {key}
                            </a>
                          ) : (
                            key
                          )}
                        </p>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Results linked by returned invalidated_by</h3>
          {[...(data?.results.values() ?? [])]
            .filter(
              (entry) =>
                (entry.result.invalidated_by ?? []).some(
                  (ref: RecordData) =>
                    ref.scenario === c.scenario &&
                    ref.defect_class === c.defect_class,
                ) &&
                entry.execution.execution_batch_id === c.execution_batch_id,
            )
            .map((entry) => (
              <p key={entry.result.id}>
                <a href={executionLink(project, entry.execution.id)}>
                  {entry.result.id}
                </a>{" "}
                · original verdict {entry.result.verdict ?? "no verdict"} ·
                invalidated — cannot support a release decision
              </p>
            ))}
          {person?.kind === "person" &&
            person.permissions.includes("review") &&
            !c.confirmed &&
            (c.confirmed_by === "human_reviewer" || c.needs_reference_review) &&
            c.assessments.length > 0 && (
              <ControlAction
                label="Human confirmation"
                busy={busy}
                confirmation
                onSubmit={(body) =>
                  void act(
                    `${projectPath(project)}/executions/${c.execution}/seeded-controls/${encodeURIComponent(c.scenario)}/confirm`,
                    body,
                  )
                }
              />
            )}
          {person?.permissions.includes("seeded_control_invalidate") &&
            ["missed", "false_alarm"].includes(c.outcome) &&
            c.invalidation_scope !== "full_run" && (
              <ControlAction
                label="Full-run invalidation"
                busy={busy}
                onSubmit={(body) =>
                  void act(
                    `${projectPath(project)}/executions/${c.execution}/seeded-controls/${encodeURIComponent(c.scenario)}/invalidate`,
                    body,
                  )
                }
              />
            )}
        </section>
      ))}
      {!busy && !eligible.length && (
        <p>No controls returned for this selection.</p>
      )}
      <section className="designer-form" aria-label="Requalification form">
        <h2>Record a Requalification</h2>
        <p>
          After a miss: fresh defect catches; after a false alarm: fresh clean
          passes; after both: both kinds for every affected class. Never reuse
          the exposed Scenario, source Execution or captured Conversation.
          Control scores must follow the diagnosed misses. The engine validates
          these conditions; selecting a record here makes no validity claim.
        </p>
        <SelectField
          label="Corrected Oracle from control Result"
          value={oracle}
          choices={[...candidates].map(([value, label]) => [value, label])}
          onChange={(value) => {
            setOracle(value);
            setKeys([]);
          }}
        />
        <InputField
          label="Requalification defect class"
          value={defect}
          onChange={setDefect}
        />
        {(data?.controls ?? [])
          .filter((c) => !defect || c.defect_class === defect)
          .flatMap((c) =>
            (c.oracles ?? [])
              .filter(
                (o: RecordData) =>
                  o.oracle === oracle &&
                  ["caught", "passed"].includes(o.outcome),
              )
              .flatMap((o: RecordData) =>
                o.result_ids.map((key: string) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      aria-label={`Qualification control ${c.scenario} ${key}`}
                      checked={keys.includes(key)}
                      onChange={(e) =>
                        setKeys((old) =>
                          e.target.checked
                            ? [...old, key]
                            : old.filter((k) => k !== key),
                        )
                      }
                    />
                    {c.scenario} · {c.kind} · {o.outcome} · {key}
                  </label>
                )),
              ),
          )}
        <InputField
          label="Diagnosis"
          value={diagnosis}
          onChange={setDiagnosis}
          rows={3}
        />
        <button
          disabled={
            busy ||
            !person?.permissions.includes("execute") ||
            !oracle ||
            !defect.trim() ||
            !keys.length ||
            !diagnosis.trim()
          }
          onClick={() =>
            void act(projectPath(project) + "/requalifications", {
              oracle,
              defect_class: defect,
              controls: keys,
              diagnosis,
            })
          }
        >
          Record Requalification
        </button>
      </section>
      <section aria-label="Requalification records">
        <h2>Engine Requalification records</h2>
        {qualifications.map((q) => (
          <details key={q.id}>
            <summary>
              {q.id} · {q.defect_class}
            </summary>
            <Raw value={q} />
          </details>
        ))}
      </section>
    </div>
  );
}
function ControlAction({
  label,
  busy,
  confirmation,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  confirmation?: boolean;
  onSubmit: (body: RecordData) => void;
}) {
  const [answer, setAnswer] = useState(""),
    [reason, setReason] = useState("");
  return (
    <section className="review-form" aria-label={label}>
      <h3>{label}</h3>
      {confirmation ? (
        <>
          <SelectField
            label="Confirmed"
            value={answer}
            choices={["true", "false"]}
            onChange={setAnswer}
          />
          <p>
            The pinned API refuses negative confirmation; false is submitted
            honestly and the engine refusal is shown.
          </p>
        </>
      ) : (
        <p>
          Every Result in the run becomes blocked. This broadens invalidation
          beyond this Oracle and class. A reason is required.
        </p>
      )}
      <InputField
        label={label + " reason"}
        value={reason}
        onChange={setReason}
        rows={2}
      />
      <button
        disabled={busy || !reason.trim() || (confirmation && !answer)}
        onClick={() =>
          onSubmit(
            confirmation
              ? {
                  confirmed: answer === "true",
                  supporting_evidence: { reason },
                }
              : { reason },
          )
        }
      >
        {label === "Human confirmation"
          ? "Record control confirmation"
          : "Invalidate full run"}
      </button>
    </section>
  );
}
