import { useEffect, useRef, useState } from "react";
import {
  projects as readProjects,
  type Project,
  type Execution,
  type Result,
} from "../api";
import { ResultCounts } from "../ResultEntries";
import {
  collection,
  executionLink,
  executionPath,
  projectPath,
  request,
  type Batch,
} from "./api";
import { ExecutionView, Failure, Raw } from "./ExecutionView";
const emptyFilters = {
  suite: "",
  environment: "",
  status: "",
  date_from: "",
  date_to: "",
};
export function RunsScreen({ route }: { route: string }) {
  const [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState(""),
    [suite, setSuite] = useState(""),
    [environment, setEnvironment] = useState(""),
    [filters, setFilters] = useState(emptyFilters),
    [applied, setApplied] = useState(emptyFilters),
    [executions, setExecutions] = useState<Execution[]>([]),
    [results, setResults] = useState<Record<string, Result[]>>({}),
    [error, setError] = useState<unknown>(),
    [runError, setRunError] = useState<unknown>(),
    [busy, setBusy] = useState(false),
    [running, setRunning] = useState(false),
    [batches, setBatches] = useState<Batch[]>([]),
    [page, setPage] = useState(0);
  const sequence = useRef(0);
  const selected = projects.find((p) => p.name === project);
  useEffect(() => {
    readProjects()
      .then((data) => {
        setProjects(data);
        setProject(data[0]?.name ?? "");
      })
      .catch(setError);
  }, []);
  async function load(name = project, query = applied) {
    if (!name) return;
    const number = ++sequence.current;
    setBusy(true);
    setError(undefined);
    try {
      const rows = await collection<Execution>(
        projectPath(name) + "/executions",
        query,
      );
      const records = await Promise.all(
        rows.map(
          async (r) =>
            [
              r.id,
              await collection<Result>(executionPath(name, r.id) + "/results"),
            ] as const,
        ),
      );
      if (number !== sequence.current) return;
      setExecutions(rows);
      setResults(Object.fromEntries(records));
      setPage(0);
    } catch (err) {
      if (number === sequence.current) setError(err);
    } finally {
      if (number === sequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    setExecutions([]);
    setResults({});
    setBatches([]);
    setSuite("");
    setEnvironment("");
    void load(project, applied);
  }, [project]);
  useEffect(() => {
    if (route === "runs" && project) void load();
  }, [route]);
  async function start() {
    if (!suite || !environment) return;
    setRunning(true);
    setRunError(undefined);
    try {
      const batch = (await request(projectPath(project) + "/executions", {
        suite,
        environment,
      })) as Batch;
      setBatches((old) => [batch, ...old]);
      setFilters(emptyFilters);
      setApplied(emptyFilters);
      await load(project, emptyFilters);
    } catch (err) {
      setRunError(err);
    } finally {
      setRunning(false);
    }
  }
  if (route.startsWith("runs/")) {
    const parts = route.split("/");
    try {
      return (
        <ExecutionView
          key={parts.slice(1).join("/")}
          project={decodeURIComponent(parts[1])}
          id={decodeURIComponent(parts[2])}
        />
      );
    } catch {
      return <Failure error="Invalid Execution URL" />;
    }
  }
  const groups = new Map<string, Execution[]>();
  for (const execution of executions) {
    const id = String(execution.execution_batch_id);
    groups.set(id, [...(groups.get(id) ?? []), execution]);
  }
  const grouped = [...groups].reverse(),
    shown = grouped.slice(page * 10, page * 10 + 10);
  const rows = (entries: Execution[], name = project) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Scenario / Execution</th>
            <th>Collection state</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                <a href={executionLink(name, e.id)}>{e.scenario}</a>
                <small>{e.id}</small>
              </td>
              <td>
                <span
                  className={`badge ${["infrastructure_failure", "failed"].includes(e.status) ? "infrastructure_failure" : "recorded"}`}
                >
                  {["infrastructure_failure", "failed"].includes(e.status)
                    ? "Infrastructure failure — no quality verdict"
                    : e.status}
                </span>
                {["infrastructure_failure", "failed"].includes(e.status) && (
                  <Raw value={e.error ?? e.failure ?? e} />
                )}
              </td>
              <td>{e.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-8 / ENGINE EXECUTIONS</p>
          <h1>Runs and Evidence</h1>
          <p className="lede">
            Every batch stays in the record. Open an Execution for its frozen
            Evidence.
          </p>
        </div>
        <button disabled={busy || running} onClick={() => void load()}>
          Refresh runs
        </button>
      </div>
      {Boolean(error) && <Failure error={error} />}
      <label className="run-project-label">
        Run Project
        <select
          aria-label="Run Project"
          value={project}
          disabled={running}
          onChange={(e) => setProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.name}>{p.name}</option>
          ))}
        </select>
      </label>
      <section className="run-control" aria-label="Start a run">
        <h2>Start a new batch</h2>
        <div className="form-grid">
          <label>
            Run Suite
            <select
              aria-label="Run Suite"
              value={suite}
              onChange={(e) => setSuite(e.target.value)}
            >
              <option value="">Choose Suite…</option>
              {selected?.suites?.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Run Environment
            <select
              aria-label="Run Environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="">Choose Environment…</option>
              {selected?.environments.map((e) => (
                <option key={e.name}>{e.name}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="primary"
          disabled={!suite || !environment || running}
          onClick={() => void start()}
        >
          {running ? "Collecting Evidence and assessing…" : "Start new batch"}
        </button>
        <p>
          Retry is restricted to infrastructure failures (Volume III); running
          the subject again after an unfavourable verdict creates a new batch
          and never resolves an earlier Result.
        </p>
        <p>No Gates are requested. The engine call is synchronous.</p>
        {Boolean(runError) && <Failure error={runError} />}
      </section>
      {batches.map((batch) => (
        <section
          className="returned-batch"
          aria-label={`Returned batch ${batch.execution_batch_id}`}
          key={batch.execution_batch_id}
        >
          <h2>
            Returned batch <code>{batch.execution_batch_id}</code>
          </h2>
          <p>
            Every Execution in this POST response, including infrastructure
            failures.
          </p>
          {rows(batch.executions)}
          {batch.warnings?.length > 0 && <Raw value={batch.warnings} />}
        </section>
      ))}
      <section className="run-filters" aria-label="Execution filters">
        <h2>Runs list</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...filters });
            void load(project, filters);
          }}
        >
          <div className="form-grid">
            <label>
              Filter Suite
              <select
                aria-label="Filter Suite"
                value={filters.suite}
                onChange={(e) =>
                  setFilters({ ...filters, suite: e.target.value })
                }
              >
                <option value="">All Suites</option>
                {selected?.suites?.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>
              Filter Environment
              <select
                aria-label="Filter Environment"
                value={filters.environment}
                onChange={(e) =>
                  setFilters({ ...filters, environment: e.target.value })
                }
              >
                <option value="">All Environments</option>
                {selected?.environments.map((e) => (
                  <option key={e.name}>{e.name}</option>
                ))}
              </select>
            </label>
            <label>
              Filter status
              <select
                aria-label="Filter status"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="">All states</option>
                {[
                  "completed",
                  "infrastructure_failure",
                  "running",
                  "queued",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Date from (ISO, with timezone)
              <input
                aria-label="Date from (ISO, with timezone)"
                placeholder="2026-10-31T00:00:00Z"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
              />
            </label>
            <label>
              Date to (ISO, with timezone)
              <input
                aria-label="Date to (ISO, with timezone)"
                placeholder="2026-11-01T00:00:00Z"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
              />
            </label>
          </div>
          <button disabled={busy || running}>Apply filters</button>
        </form>
        <p>
          Filters select Execution records; a filtered batch lists its matching
          Executions only. All engine pages are read before grouping by batch.
          Ten batches per display page.
        </p>
      </section>
      {busy && <p role="status">Reading engine pages…</p>}
      {shown.map(([id, entries]) => (
        <section className="run-batch" aria-label={`Batch ${id}`} key={id}>
          <h2>
            Batch <code>{id}</code>
          </h2>
          <p>
            {entries[0].created_at} · Suite {entries[0].suite} · Environment{" "}
            {entries[0].environment} · {entries.length} matching Executions
          </p>
          <ResultCounts
            results={entries.flatMap((e) => results[e.id] ?? [])}
            onEvidence={(r) => {
              const e = entries.find((e) =>
                (results[e.id] ?? []).some((item) => item.id === r.id),
              );
              if (e) location.hash = executionLink(project, e.id).slice(1);
            }}
          />
          {rows(entries)}
        </section>
      ))}
      {!busy && !error && grouped.length === 0 && (
        <p>No matching batches returned by the engine.</p>
      )}
      <div className="button-row">
        <button disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
          Previous batches
        </button>
        <span>
          Page {page + 1} · {grouped.length} matching batches
        </span>
        <button
          disabled={(page + 1) * 10 >= grouped.length}
          onClick={() => setPage((n) => n + 1)}
        >
          Next batches
        </button>
      </div>
    </>
  );
}
