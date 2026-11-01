import { useEffect, useRef, useState } from "react";
import { projects as readProjects, type Result } from "../api";
import { ResultCounts } from "../ResultEntries";
import { chains, type RecordData } from "../runs/api";
import { Failure } from "../runs/ExecutionView";
import { SelectField } from "../workspace/OracleFields";
import {
  G8,
  LIVE_INTERVAL,
  evaluations,
  latestResults,
  loadDecisions,
  resultLink,
  routeLink,
  segments,
  type Decisions,
} from "./api";
import { GateCards } from "./GateCards";
import { Trend } from "./Trend";
import { oracleName } from "../format";

export function Dashboard({ route }: { route: string }) {
  const parts = segments(route),
    [projects, setProjects] = useState<RecordData[]>([]),
    [project, setProject] = useState(parts[1] ?? ""),
    [suite, setSuite] = useState(parts[2] ?? ""),
    [environment, setEnvironment] = useState(parts[3] ?? ""),
    [data, setData] = useState<Decisions>(),
    [rows, setRows] = useState<Awaited<ReturnType<typeof latestResults>>>([]),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [refreshed, setRefreshed] = useState("");
  const refresh = useRef<() => void>(() => {}),
    root = projects.find((p) => p.name === project);
  useEffect(() => {
    readProjects()
      .then((records) => {
        setProjects(records);
        if (!project)
          setProject(
            records.find((p) => p.name === "aster-support-decisions")?.name ??
              records[0]?.name ??
              "",
          );
      })
      .catch(setError);
  }, []);
  useEffect(() => {
    let active = true,
      inFlight = false;
    setData(undefined);
    setRows([]);
    setRefreshed("");
    setError(undefined);
    async function read() {
      if (inFlight || !project || !suite || !environment) return;
      inFlight = true;
      setBusy(true);
      try {
        const records = await loadDecisions(project),
          latest = await latestResults(
            project,
            records.executions,
            suite,
            environment,
          );
        if (active) {
          setData(records);
          setRows(latest);
          setRefreshed(new Date().toISOString());
          setError(undefined);
        }
      } catch (e) {
        if (active) setError(e);
      } finally {
        inFlight = false;
        if (active) setBusy(false);
      }
    }
    refresh.current = () => void read();
    void read();
    const timer = setInterval(() => void read(), LIVE_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
      refresh.current = () => {};
    };
  }, [project, suite, environment]);
  const views = data
      ? evaluations(project, data).filter(
          (v) =>
            v.suites.includes(suite) && v.environments.includes(environment),
        )
      : [],
    latest = views.at(-1);
  const heads = rows.flatMap((entry) =>
    chains(entry.results as Result[]).map((chain) => ({
      execution: entry.execution,
      result: chain.at(-1)!,
    })),
  );
  const work = heads.filter(
    ({ result }) =>
      ["awaiting_review", "inconclusive", "oracle_unavailable"].includes(
        result.disposition,
      ) || result.invalidated_by?.length,
  );
  const unadmitted = [
    ...new Set(
      heads
        .filter(({ result }) => result.oracle_type === "judge")
        .map(({ result }) => result.oracle),
    ),
  ].filter(
    (oracle) =>
      data?.admissions.filter((a) => a.oracle === oracle).at(-1)?.admitted !==
      true,
  );
  return (
    <div className="dashboard-live trust-screen">
      <div className="live-banner" data-testid="live-marker">
        <strong>Live view — updates as new Results arrive</strong>
        <p>
          Automatic refresh every {LIVE_INTERVAL / 1000} seconds · last
          successful refresh:{" "}
          <time data-testid="last-refresh">
            {refreshed || "not refreshed yet"}
          </time>
        </p>
      </div>
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-10 / ONGOING MONITORING</p>
          <h1>Dashboard</h1>
        </div>
        <button
          disabled={busy || !suite || !environment}
          onClick={() => refresh.current()}
        >
          Refresh live view
        </button>
      </div>
      <section className="run-filters" aria-label="Dashboard scope">
        <SelectField
          label="Dashboard Project"
          value={project}
          choices={projects.map((p) => p.name)}
          onChange={(value) => {
            setProject(value);
            setSuite("");
            setEnvironment("");
          }}
        />
        <SelectField
          label="Dashboard Suite"
          value={suite}
          choices={(root?.suites ?? []).map((s: RecordData) => s.name)}
          onChange={setSuite}
        />
        <SelectField
          label="Dashboard Environment"
          value={environment}
          choices={(root?.environments ?? []).map((e: RecordData) => e.name)}
          onChange={setEnvironment}
        />
      </section>
      {Boolean(error) && <Failure error={error} />}
      {(!suite || !environment) && (
        <p>Choose a Suite and Environment explicitly.</p>
      )}
      <p className="notice">{G8}</p>
      <p>
        Refresh reads engine data; it does not evaluate Gates or compute
        Metrics.{" "}
        <a href={routeLink("gates", project)}>
          Evaluate all applicable Gates →
        </a>
      </p>
      <h2>Latest returned stored Gate decisions</h2>
      {latest ? (
        <>
          <p>
            Snapshot {latest.snapshot} · {latest.timeKind}:{" "}
            {latest.at ?? "not returned"} · batch {latest.batch}
          </p>
          <GateCards
            project={project}
            gates={latest.gates}
            view={latest}
            data={data}
            onEvidence={() => {
              location.hash = routeLink(
                "gates",
                project,
                latest.batch,
                latest.snapshot,
                "results",
              ).slice(1);
            }}
          />
        </>
      ) : (
        <p>
          No stored evaluation returned for this scope. None is inferred from
          Result counts.
        </p>
      )}
      <section aria-label="Latest Result counts">
        <h2>Latest Results — counts, not a verdict</h2>
        <p>
          Product executions only. Controls are shown separately in Seeded
          Controls. As in Explorer, every Result returned for each latest
          Scenario Execution remains visible; recorded resolution links are
          preserved.
        </p>
        {rows.map((entry) => (
          <article className="dashboard-results" key={entry.execution.id}>
            <h3>{entry.execution.scenario}</h3>
            <a href={routeLink("runs", project, entry.execution.id)}>
              {entry.execution.id}
            </a>
            {entry.results.length ? (
              <ResultCounts
                results={entry.results as Result[]}
                onEvidence={(result) => {
                  location.hash = resultLink(
                    project,
                    result.id,
                    entry.execution.execution_batch_id,
                  ).slice(1);
                }}
              />
            ) : (
              <p>
                No Results returned by the engine. Collection state:{" "}
                {entry.execution.status}
              </p>
            )}
          </article>
        ))}
        {!rows.length && <p>No Result records returned for this selection.</p>}
      </section>
      <section aria-label="Open work">
        <h2>Open work from returned Result states</h2>
        <p>
          The latest links below follow only the engine's resolves fields. A
          fresh Gate evaluation remains the authority for whether a Release
          Decision is blocked.
        </p>
        <ul>
          {work.map(({ execution, result }) => (
            <li key={result.id}>
              <a
                href={resultLink(
                  project,
                  result.id,
                  execution.execution_batch_id,
                )}
              >
                {execution.scenario} · {result.id}
              </a>{" "}
              ·{" "}
              <span className={`badge ${result.disposition}`}>
                {result.disposition}
              </span>
              {result.invalidated_by?.length ? (
                <span className="badge invalidated">
                  invalidated by a control — original verdict{" "}
                  {result.verdict ?? "no verdict"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {!work.length && (
          <p>No matching open-work states returned; this is not a Gate pass.</p>
        )}
        <h3>Judges not admitted</h3>
        <ul>
          {unadmitted.map((oracle) => (
            <li key={oracle}>
              <a href={routeLink("admission", project, oracle)}>
                Admission · {oracleName(oracle)} →
              </a>
              <details>
                <summary>Exact configuration and accepted status</summary>
                <code>{oracle}</code>
                <p>
                  {data?.admissions.filter((a) => a.oracle === oracle).at(-1)
                    ?.admitted === false
                    ? "Latest accepted Admission: admitted false"
                    : "No Admission record returned"}
                </p>
              </details>
            </li>
          ))}
        </ul>
        {!unadmitted.length && (
          <p>
            No unadmitted configuration found in these returned Judge records;
            no release status is inferred.
          </p>
        )}
      </section>
      <Trend project={project} views={views} />
    </div>
  );
}
