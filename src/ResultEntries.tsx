import type { Execution, Result } from "./api";

export function clauseLabel(reference: string) {
  const unnamed = reference.match(
    /^sha256:[^/]+\/(constraints|expectations)\/(\d+)$/,
  );
  return unnamed
    ? `unnamed clause · ${unnamed[1]} position ${Number(unnamed[2]) + 1}`
    : reference;
}
function oracleLabel(result: Result) {
  const kind =
    result.oracle_type === "validator"
      ? "Validator"
      : result.oracle_type === "judge"
        ? "Judge"
        : result.oracle_type === "human"
          ? "Human Reviewer"
          : result.oracle_type;
  let identifier = result.oracle;
  try {
    const oracle = JSON.parse(result.oracle);
    identifier = oracle.model ?? oracle.name ?? oracle.role ?? result.oracle;
  } catch {
    /* Preserve identifiers that the engine does not serialize as JSON. */
  }
  return `${kind} · ${identifier}`;
}
export function ResultEntries({
  results,
  onEvidence,
}: {
  results: Result[];
  onEvidence: (result: Result) => void;
}) {
  const groups = new Map<string, Result[]>();
  for (const result of results)
    groups.set(result.clause, [...(groups.get(result.clause) ?? []), result]);
  return (
    <div className="result-groups">
      {[...groups].map(([clause, entries]) => (
        <section className="result-group" key={clause}>
          <strong>{clauseLabel(clause)}</strong>
          {entries.map((result) => (
            <div className="result-entry" key={result.id}>
              <span className="oracle-label">{oracleLabel(result)}</span>
              <span
                className={`badge ${result.invalidated_by?.length ? "invalidated" : result.disposition === "actionable" ? result.verdict : result.disposition}`}
              >
                {result.invalidated_by?.length ? "invalidated · " : ""}
                {result.disposition}
                {result.verdict ? ` · ${result.verdict}` : ""}
              </span>
              <span>
                Confidence:{" "}
                {result.confidence === "not_applicable"
                  ? "not applicable"
                  : result.confidence === undefined
                    ? result.oracle_type === "validator"
                      ? "not applicable (Validator)"
                      : "not recorded by engine"
                    : String(result.confidence)}
              </span>
              {result.resolves && (
                <span className="resolution">
                  Resolves Result {result.resolves} (engine record)
                </span>
              )}
              <button
                className="evidence-link"
                onClick={() => onEvidence(result)}
                aria-label={`Evidence for ${clauseLabel(clause)} Result ${result.id}`}
              >
                Open Result Evidence ↗
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
export function ResultEvidence({
  result,
  execution,
}: {
  result: Result;
  execution: Execution;
}) {
  return (
    <section className="result-evidence" aria-label="Selected Result Evidence">
      <h3>Result Evidence · {clauseLabel(result.clause)}</h3>
      <p>
        {oracleLabel(result)} · Result {result.id}
      </p>
      {result.resolves && (
        <p>Resolves {result.resolves}, exactly as recorded by the engine.</p>
      )}
      <h4>Frozen Conversation and Artifacts</h4>
      <pre className="json">
        {JSON.stringify(
          {
            conversation: execution.conversation,
            artifacts: execution.artifacts,
          },
          null,
          2,
        )}
      </pre>
      <h4>Oracle configuration and recorded supporting Evidence</h4>
      <pre className="json">
        {JSON.stringify({ oracle: result.oracle, result }, null, 2)}
      </pre>
    </section>
  );
}
