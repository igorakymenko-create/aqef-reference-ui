import { useEffect, useState } from "react";
import type { Execution, Result } from "../api";
import { EngineError } from "../api";
import { ResultEntries, clauseLabel } from "../ResultEntries";
import {
  chains,
  collection,
  executionPath,
  localPerson,
  request,
  type RecordData,
  type Person,
} from "./api";

export function Raw({ value }: { value: unknown }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}
export function Failure({ error }: { error: unknown }) {
  return (
    <div role="alert" className="error">
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
    </div>
  );
}
const confidence = (value: unknown) =>
  value === "not_applicable"
    ? "not applicable"
    : value === undefined
      ? "not recorded"
      : String(value);

function Artifacts({ items }: { items: RecordData[] }) {
  return (
    <section aria-label="Recorded Artifacts">
      <h2>Artifacts</h2>
      {items.length === 0 ? (
        <p>No Artifacts recorded by the engine.</p>
      ) : (
        items.map((a, index) => (
          <article className="artifact-card" key={a.id ?? index}>
            <h3>
              {a.name} · turn {a.turn ?? "not recorded"}
            </h3>
            {a.name === "retrieved_context" &&
            Array.isArray(a.data) &&
            a.data.every(
              (item: unknown) =>
                item && typeof item === "object" && !Array.isArray(item),
            ) ? (
              a.data.map((source: RecordData, i: number) => (
                <div key={i}>
                  <strong>{source.source ?? "Source not recorded"}</strong>
                  <p className="evidence-text">
                    {source.text ?? "Text not recorded"}
                  </p>
                  <details>
                    <summary>Recorded source fields</summary>
                    <Raw value={source} />
                  </details>
                </div>
              ))
            ) : a.name === "tool_calls" &&
              Array.isArray(a.data) &&
              a.data.every(
                (item: unknown) =>
                  item && typeof item === "object" && !Array.isArray(item),
              ) ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Arguments</th>
                      <th>Outcome where recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.data.map((call: RecordData, i: number) => (
                      <tr key={i}>
                        <td>{call.name ?? call.tool ?? "not recorded"}</td>
                        <td>
                          <Raw value={call.arguments} />
                        </td>
                        <td>
                          {Object.hasOwn(call, "outcome") ? (
                            <Raw value={call.outcome} />
                          ) : (
                            "not recorded"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Raw value={a.data} />
            )}
            <details>
              <summary>Complete recorded Artifact</summary>
              <Raw value={a} />
            </details>
          </article>
        ))
      )}
    </section>
  );
}
function ReviewForm({
  captures,
  busy,
  onSubmit,
}: {
  captures: boolean;
  busy: boolean;
  onSubmit: (body: RecordData) => void;
}) {
  const [verdict, setVerdict] = useState(""),
    [reason, setReason] = useState(""),
    [rating, setRating] = useState("");
  const valid = Boolean(
    verdict &&
      reason.trim() &&
      (!captures ||
        (rating.trim() &&
          Number.isFinite(Number(rating)) &&
          Number(rating) >= 0 &&
          Number(rating) <= 1)),
  );
  return (
    <form
      className="review-form"
      aria-label="Human Review form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid)
          onSubmit({
            verdict,
            supporting_evidence: { reason: reason.trim() },
            ...(captures ? { confidence: Number(rating) } : {}),
          });
      }}
    >
      <label>
        Review verdict
        <select
          aria-label="Review verdict"
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
        >
          <option value="">Choose explicitly…</option>
          <option value="pass">pass</option>
          <option value="fail">fail</option>
        </select>
      </label>
      <label>
        Supporting reason
        <textarea
          aria-label="Supporting reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </label>
      {captures && (
        <label>
          Review Confidence
          <input
            aria-label="Review Confidence"
            type="number"
            min="0"
            max="1"
            step="any"
            required
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </label>
      )}
      <button className="primary" disabled={busy || !valid}>
        Record Human Review
      </button>
    </form>
  );
}
export function ExecutionView({
  project,
  id,
}: {
  project: string;
  id: string;
}) {
  const [execution, setExecution] = useState<Execution>(),
    [results, setResults] = useState<Result[]>([]),
    [artifacts, setArtifacts] = useState<RecordData[]>([]),
    [transcript, setTranscript] = useState<RecordData>(),
    [transcriptError, setTranscriptError] = useState<unknown>(),
    [error, setError] = useState<unknown>(),
    [actionError, setActionError] = useState<unknown>(),
    [person, setPerson] = useState<Person>(),
    [busy, setBusy] = useState(false),
    [actionBusy, setActionBusy] = useState(false),
    [reviewId, setReviewId] = useState(""),
    [notice, setNotice] = useState("");
  const path = executionPath(project, id);
  async function load() {
    setBusy(true);
    setError(undefined);
    setTranscript(undefined);
    setTranscriptError(undefined);
    const reads = await Promise.allSettled([
      request(path),
      collection<Result>(path + "/results"),
      collection<RecordData>(path + "/artifacts"),
      request(path + "/conversation"),
      localPerson(),
    ]);
    if (reads[0].status === "fulfilled") setExecution(reads[0].value);
    else setError(reads[0].reason);
    if (reads[1].status === "fulfilled") setResults(reads[1].value);
    else setError(reads[1].reason);
    if (reads[2].status === "fulfilled") setArtifacts(reads[2].value);
    else setError(reads[2].reason);
    if (reads[3].status === "fulfilled") setTranscript(reads[3].value);
    else setTranscriptError(reads[3].reason);
    if (reads[4].status === "fulfilled") setPerson(reads[4].value);
    else {
      setPerson(undefined);
      setError(reads[4].reason);
    }
    setBusy(false);
  }
  useEffect(() => {
    setExecution(undefined);
    setResults([]);
    setReviewId("");
    setActionError(undefined);
    setNotice("");
    void load();
  }, [project, id]);
  async function act(
    result: Result,
    kind: "review" | "reassess",
    body: RecordData,
  ) {
    setActionBusy(true);
    setActionError(undefined);
    setNotice("");
    try {
      const returned = await request(
        path + "/results/" + encodeURIComponent(result.id) + "/" + kind,
        body,
      );
      setReviewId("");
      setNotice(
        kind === "review"
          ? returned.id === result.id
            ? "Human Review completed in place — the engine’s single documented in-place completion. Original id and recorded_at retained."
            : "New Human Result recorded with resolves; the original Judge Result remains visible."
          : `Re-check recorded ${returned.disposition}; new Result ${returned.id} resolves ${result.id}. The subject was not called.`,
      );
      await load();
    } catch (err) {
      setActionError(err);
    } finally {
      setActionBusy(false);
    }
  }
  const configuration = (execution?.configuration ?? {}) as RecordData;
  const pendingTargets = new Set(
    results.map((r) => r.resolves).filter(Boolean),
  );
  const can = (permission: string) => person?.permissions.includes(permission);
  return (
    <>
      <a href="#runs">← Runs and Evidence</a>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EXECUTION / ENGINE RECORD</p>
          <h1>Execution {id}</h1>
        </div>
        <button disabled={busy || actionBusy} onClick={() => void load()}>
          Refresh Execution
        </button>
      </div>
      {Boolean(error) && <Failure error={error} />}
      {Boolean(actionError) && <Failure error={actionError} />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {execution && (
        <>
          <p>
            Batch <code>{String(execution.execution_batch_id)}</code> · Suite{" "}
            {execution.suite} · Scenario {execution.scenario} · Environment{" "}
            {execution.environment}
          </p>
          <p>
            <span
              className={`badge ${["infrastructure_failure", "failed"].includes(execution.status) ? "infrastructure_failure" : "recorded"}`}
            >
              {["infrastructure_failure", "failed"].includes(execution.status)
                ? "Infrastructure failure — no quality verdict"
                : execution.status}
            </span>{" "}
            · {execution.created_at}
          </p>
          {["infrastructure_failure", "failed"].includes(execution.status) && (
            <Raw value={execution.error ?? execution.failure ?? execution} />
          )}
          <section aria-label="Conversation">
            <h2>Conversation</h2>
            {transcriptError instanceof EngineError &&
            transcriptError.status === 409 ? (
              <>
                <p className="notice">no completed transcript</p>
                <Failure error={transcriptError} />
              </>
            ) : transcriptError ? (
              <Failure error={transcriptError} />
            ) : transcript ? (
              <>
                {(transcript.turns ?? []).map(
                  (turn: RecordData, index: number) => (
                    <article className="turn-card" key={index}>
                      <h3>Turn {index + 1}</h3>
                      <h4>Prompt</h4>
                      <p className="evidence-text">
                        {typeof turn.prompt === "string"
                          ? turn.prompt
                          : JSON.stringify(turn.prompt)}
                      </p>
                      <h4>Response</h4>
                      <p className="evidence-text">
                        {typeof turn.response === "string"
                          ? turn.response
                          : JSON.stringify(turn.response)}
                      </p>
                      <details>
                        <summary>Complete turn record</summary>
                        <Raw value={turn} />
                      </details>
                    </article>
                  ),
                )}
              </>
            ) : (
              <p>Loading transcript…</p>
            )}
          </section>
          <Artifacts items={artifacts} />
          <section aria-label="Frozen configuration">
            <h2>Frozen configuration</h2>
            <p className="notice">
              frozen at execution; later configuration changes do not apply here
            </p>
            <p>
              Environment, resolved Contract and Oracle configurations are the
              engine’s frozen record.
            </p>
            <Raw value={configuration} />
            <details>
              <summary>
                Complete Execution metadata, including recorded latency and
                usage
              </summary>
              <Raw value={execution} />
            </details>
          </section>
          <section aria-label="Resolution chains">
            <h2>Results and resolution chains</h2>
            <p>
              Oldest link first. Only recorded resolves links are followed;
              these labels do not determine Gate effective state.
            </p>
            {results.length === 0 ? (
              <p>No Results recorded by the engine.</p>
            ) : (
              chains(results).map((chain, index) => (
                <section
                  className="resolution-chain"
                  key={chain[0].id}
                  aria-label={`Resolution chain ${index + 1}`}
                >
                  <h3>{clauseLabel(chain[0].clause)}</h3>
                  {chain.map((result, position) => {
                    const support = (result.supporting_evidence ??
                      {}) as RecordData;
                    const clause =
                      (configuration.contract?.expectations ?? []).find(
                        (c: RecordData, i: number) =>
                          c.id === result.clause ||
                          (!c.id &&
                            result.clause.endsWith("/expectations/" + i)),
                      ) ?? {};
                    const route = result.review_route as RecordData | undefined;
                    const current = !pendingTargets.has(result.id);
                    const uninvalidated = !result.invalidated_by?.length;
                    const required =
                      route?.required_roles ??
                      (clause.human_reviewer?.role
                        ? [clause.human_reviewer.role]
                        : []);
                    const roleMatch = required.every((role: string) =>
                      person?.roles.includes(role),
                    );
                    const reviewable =
                      current &&
                      uninvalidated &&
                      ["inconclusive", "awaiting_review"].includes(
                        result.disposition,
                      ) &&
                      can("review") &&
                      person?.kind === "person" &&
                      roleMatch;
                    const recheck =
                      current &&
                      uninvalidated &&
                      result.disposition === "oracle_unavailable" &&
                      can("execute");
                    const captures =
                      route?.captures_confidence ??
                      clause.human_reviewer?.captures_confidence ??
                      false;
                    return (
                      <article
                        className="chain-link"
                        key={result.id}
                        data-result-id={result.id}
                      >
                        <div className="chain-record-heading">
                          <code>{result.id}</code>
                          {current && position === chain.length - 1 && (
                            <span className="badge recorded">
                              latest in this chain
                            </span>
                          )}
                        </div>
                        {result.resolves && (
                          <p>
                            resolves <code>{result.resolves}</code>
                            {!results.some((r) => r.id === result.resolves) &&
                              " · earlier record not returned"}
                          </p>
                        )}
                        <ResultEntries
                          results={[result]}
                          onEvidence={() =>
                            document
                              .getElementById("support-" + result.id)
                              ?.scrollIntoView({ block: "center" })
                          }
                        />
                        <p>
                          recorded_at: <time>{String(result.recorded_at)}</time>
                        </p>
                        <h4>Frozen Oracle string</h4>
                        <pre className="json">{result.oracle}</pre>
                        <div id={"support-" + result.id}>
                          <h4>Supporting evidence returned by the engine</h4>
                          {support.criteria && (
                            <p className="evidence-text">
                              Criteria: {support.criteria}
                            </p>
                          )}
                          {support.explanation && (
                            <p className="evidence-text">
                              Explanation: {support.explanation}
                            </p>
                          )}
                          {support.provider_response && (
                            <>
                              <h5>Recorded provider response</h5>
                              <Raw value={support.provider_response} />
                            </>
                          )}
                          {support.attempts && (
                            <>
                              <h5>Recorded attempts</h5>
                              <Raw value={support.attempts} />
                            </>
                          )}
                          <details>
                            <summary>
                              Complete supporting evidence (engine record)
                            </summary>
                            <Raw value={support} />
                          </details>
                        </div>
                        {result.panel && (
                          <>
                            <h4>Panel counts — recorded by engine</h4>
                            <Raw value={result.panel} />
                          </>
                        )}
                        {Array.isArray(support.member_results) && (
                          <section aria-label="Recorded panel members">
                            <h4>
                              Every configured panel member — engine records
                            </h4>
                            {support.member_results.map(
                              (member: RecordData, i: number) => (
                                <article
                                  className="panel-member"
                                  key={member.id ?? i}
                                >
                                  <strong>Member {i + 1}</strong>
                                  <p>
                                    {member.oracle} · {member.disposition} ·{" "}
                                    {member.verdict ?? "no verdict"} ·
                                    Confidence: {confidence(member.confidence)}
                                  </p>
                                  <Raw value={member} />
                                </article>
                              ),
                            )}
                          </section>
                        )}
                        {route && (
                          <section aria-label="Review route">
                            <h4>review_route — engine record</h4>
                            <Raw value={route} />
                          </section>
                        )}
                        {result.oracle_type === "human_reviewer" &&
                          support.reviewed_at && (
                            <p className="notice">
                              Completed in place: the engine’s single documented
                              in-place Human Review completion.
                            </p>
                          )}
                        {reviewable && (
                          <>
                            <button
                              onClick={() =>
                                setReviewId(
                                  reviewId === result.id ? "" : result.id,
                                )
                              }
                            >
                              Review this Result
                            </button>
                            {reviewId === result.id && (
                              <ReviewForm
                                captures={captures}
                                busy={actionBusy}
                                onSubmit={(body) =>
                                  void act(result, "review", body)
                                }
                              />
                            )}
                          </>
                        )}
                        {current &&
                          ["inconclusive", "awaiting_review"].includes(
                            result.disposition,
                          ) &&
                          !reviewable && (
                            <p>
                              Human Review unavailable to the configured local
                              Person. The routed Roles and review permission are
                              required; engine acceptance remains authoritative.
                            </p>
                          )}
                        {recheck && (
                          <>
                            <button
                              disabled={actionBusy}
                              onClick={() =>
                                void act(result, "reassess", {
                                  oracle: result.oracle,
                                })
                              }
                            >
                              Re-check with the same Oracle
                            </button>
                            <p>
                              The subject is not called. The exact frozen Oracle
                              string is sent; a continued outage records another
                              oracle_unavailable Result.
                            </p>
                          </>
                        )}
                        {current &&
                          result.disposition === "oracle_unavailable" && (
                            <p>
                              <button disabled>
                                Re-assess with corrected Oracle
                              </button>{" "}
                              Unavailable here: corrected Oracle needs
                              Requalification (UI-5).
                            </p>
                          )}
                      </article>
                    );
                  })}
                </section>
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
