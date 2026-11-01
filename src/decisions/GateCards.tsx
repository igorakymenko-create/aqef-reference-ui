import { figure } from "../format";
import { Raw } from "../runs/ExecutionView";
import type { RecordData } from "../runs/api";
import { overrideFor, type Decisions, type Evaluation } from "./api";

const reasons: Record<string, string> = {
  threshold: "The aggregate fell short of its declared threshold.",
  insufficient_basis:
    "The declared minimum Basis was not met, or no aggregate could be computed.",
  non_actionable_results:
    "The aggregate included effective Results that are not actionable: inconclusive, awaiting_review, oracle_unavailable or not_assessed.",
  seeded_control_miss:
    "An Oracle missed a defect control; affected Results cannot support a decision to ship.",
  seeded_control_false_alarm:
    "A false alarm on a clean control invalidated affected Results.",
  judge_not_admitted:
    "The Gate requires admitted Judges and read a Judge configuration that is not admitted.",
  stale_results:
    "Results were produced under a different Environment or clause than this evaluation's Snapshot.",
};
const basisKeys = [
  "results",
  "not_actionable",
  "scenarios",
  "executions",
  "min_basis_met",
];
export function Basis({
  data,
  onEvidence,
}: {
  data?: RecordData;
  onEvidence?: () => void;
}) {
  return (
    <dl className="basis-grid" aria-label="Aggregate Basis">
      {basisKeys.map((key) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {data && Object.hasOwn(data, key) ? (
              onEvidence && key !== "min_basis_met" ? (
                <button className="number-link" onClick={onEvidence}>
                  {String(data[key])}
                </button>
              ) : (
                String(data[key])
              )
            ) : (
              "not returned"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Value({
  value,
  onEvidence,
}: {
  value: unknown;
  onEvidence?: () => void;
}) {
  return value === "not_computed" ? (
    <span className="badge not_computed">not_computed</span>
  ) : value && typeof value === "object" ? (
    <dl>
      {Object.entries(value).map(([key, v]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            <Value value={v} onEvidence={onEvidence} />
          </dd>
        </div>
      ))}
    </dl>
  ) : onEvidence && typeof value === "number" ? (
    <button className="number-link" onClick={onEvidence}>
      {figure(value)}
    </button>
  ) : (
    <span>{figure(value)}</span>
  );
}
export function Approval({
  record,
  frozen = false,
  recordKind = "Report",
}: {
  record: RecordData;
  frozen?: boolean;
  recordKind?: string;
}) {
  return (
    <aside className="override-record" aria-label="Override Approval">
      <strong>Overridden · Approval {record.approval_id}</strong>
      {frozen ? (
        <p>
          Only the Approval reference copied into this {recordKind} is shown. No
          current Approval information is fetched.
        </p>
      ) : (
        <>
          <p>
            Approver: {record.approved_by ?? "not returned"} · approved_at:{" "}
            {record.approved_at ?? "not returned"} · Role:{" "}
            {record.approval_role ?? "not returned"}
          </p>
          {record.approval_created_at && (
            <p>
              Approval record created_at: {record.approval_created_at} (not an
              inferred approved_at).
            </p>
          )}
          {record.justification && <p>{record.justification}</p>}
        </>
      )}
      <details>
        <summary>Recorded Approval information</summary>
        <Raw value={record} />
      </details>
    </aside>
  );
}
export function GateCards({
  project,
  gates,
  view,
  data,
  frozen = false,
  recordKind = "Report",
  latest = false,
  onEvidence,
  onOverride,
}: {
  project: string;
  gates?: RecordData;
  view?: Evaluation;
  data?: Decisions;
  frozen?: boolean;
  recordKind?: string;
  latest?: boolean;
  onEvidence?: () => void;
  onOverride?: (name: string, gate: RecordData) => void;
}) {
  if (!gates) return <p>No GateResults returned by the engine.</p>;
  if (!Object.keys(gates).length)
    return <p>The engine returned no applicable Gates.</p>;
  return (
    <section className="gate-decisions" aria-label="Gate decisions">
      {Object.entries(gates).map(([name, gate]) => {
        const override = frozen
          ? gate.override
            ? { approval_id: gate.override }
            : undefined
          : overrideFor(project, gate, data);
        const definition =
          !frozen && view
            ? data?.snapshots
                .find((s) => s.id === view.snapshot)
                ?.quality_gates?.find((g: RecordData) => g.name === name)
            : undefined;
        const aggregate = gate.aggregate ?? definition?.aggregate;
        return (
          <article
            className={`gate-card gate-${gate.status ?? "unknown"}`}
            key={gate.id ?? name}
            aria-label={`Gate ${name}`}
          >
            <header>
              <div>
                <h2>{name}</h2>
                <p>
                  GateResult <code>{gate.id ?? "not returned"}</code>
                </p>
                <p>Aggregate: {aggregate ?? "not included in this record"}</p>
              </div>
              <div className="gate-labels">
                <span
                  className={`badge ${gate.status === "pass" ? "pass" : gate.status === "fail" ? "fail" : "unknown"}`}
                >
                  status: {gate.status ?? "not returned"}
                </span>
                <strong className="scope-label">
                  {gate.blocking === true
                    ? "Blocking"
                    : gate.blocking === false
                      ? "Advisory"
                      : "Blocking/advisory not returned"}
                </strong>
                {override && (
                  <span className="badge overridden">
                    overridden — status remains {gate.status}
                  </span>
                )}
              </div>
            </header>
            <section aria-label="Recorded value">
              <h3>Value</h3>
              <Value value={gate.value} onEvidence={onEvidence} />
              {onEvidence && (
                <button className="text-link" onClick={onEvidence}>
                  Open this evaluation's Result IDs and Evidence →
                </button>
              )}
            </section>
            <h3>Threshold</h3>
            <Value value={gate.threshold} onEvidence={onEvidence} />
            <h3>Aggregate Basis</h3>
            {definition?.min_basis && (
              <p>
                Declared min_basis:{" "}
                {Object.entries(definition.min_basis)
                  .filter(([, value]) => value !== null)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(", ")}
              </p>
            )}
            <Basis data={gate.basis} onEvidence={onEvidence} />
            {gate.metric_basis && (
              <section aria-label="Per-metric Basis">
                <h3>metric_basis per sub-metric</h3>
                {Object.entries(gate.metric_basis).map(([key, basis]) => (
                  <div key={key}>
                    <h4>{key}</h4>
                    <Basis data={basis as RecordData} onEvidence={onEvidence} />
                  </div>
                ))}
              </section>
            )}
            {gate.status === "fail" && (
              <section
                className="gate-reasons"
                aria-label="Recorded failure reasons"
              >
                <h3>Every recorded reason</h3>
                {Array.isArray(gate.reasons) ? (
                  <ul>
                    {gate.reasons.map((reason: string) => (
                      <li key={reason} data-reason={reason}>
                        <code>{reason}</code>
                        <p>
                          {reasons[reason] ??
                            "No explanation for this code is provided in the pinned specification; the engine's code is preserved."}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No reasons returned by the engine.</p>
                )}
                {gate.reasons?.includes("threshold") && (
                  <p>Failed its threshold.</p>
                )}
                {gate.basis?.min_basis_met === false && (
                  <p>Fell short of its declared minimum Basis.</p>
                )}
              </section>
            )}
            {override && (
              <Approval
                record={override}
                frozen={frozen}
                recordKind={recordKind}
              />
            )}
            {latest &&
              gate.status === "fail" &&
              gate.blocking === true &&
              !override &&
              onOverride && (
                <button onClick={() => onOverride(name, gate)}>
                  Override {name}
                </button>
              )}
            {frozen && (
              <p className="footnote">
                Immutable Gate copy in this {recordKind}. Evaluation-wide Result
                IDs are not included in this resource.
              </p>
            )}
            <details>
              <summary>Show engine record</summary>
              <Raw value={gate} />
            </details>
            {view?.sourceReport && (
              <p className="footnote">
                Gate copy supplied by saved Report {view.sourceReport}.
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
