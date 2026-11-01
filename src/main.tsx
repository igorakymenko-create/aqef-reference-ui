import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as api from "./api";
import { ResultEntries, ResultEvidence, ResultCounts } from "./ResultEntries";
import { WorkspaceScreen } from "./workspace/WorkspaceScreen";
import { RunsScreen } from "./runs/RunsScreen";
import { SimulatorControl } from "./runs/SimulatorControl";
import { AdmissionScreen } from "./trust/AdmissionScreen";
import { ControlsScreen } from "./trust/ControlsScreen";
import { GatesScreen } from "./decisions/GatesScreen";
import { ReportsScreen, ReportDocument } from "./decisions/ReportsScreen";
import { Dashboard } from "./decisions/Dashboard";
import { ReleasesScreen } from "./decisions/ReleasesScreen";
import { ResultLocator, MetricEvidence } from "./decisions/Evidence";
import "./style.css";

function Badge({
  children,
  state = "neutral",
}: {
  children: React.ReactNode;
  state?: string;
}) {
  return (
    <span className={`badge ${state.replace(/[^a-z_]/g, "")}`}>{children}</span>
  );
}
function Json({ value }: { value: unknown }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}
function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="error">
      <strong>Could not read the engine</strong>
      <pre>{error instanceof Error ? error.message : String(error)}</pre>
      <p>The engine response is shown verbatim. Refresh to try again.</p>
    </div>
  );
}
function time(value: string) {
  return new Date(value).toLocaleString();
}

function Connections() {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>();
  async function refresh() {
    setBusy(true);
    setError(undefined);
    setHealth({});
    try {
      const data = await api.providers();
      setMapping(data);
      const statuses = await Promise.all(
        Object.keys(data).map(async (model) => [
          model,
          await api.providerHealth(model),
        ]),
      );
      setHealth(Object.fromEntries(statuses));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEPLOYMENT / PROVIDERS</p>
          <h1>Connections</h1>
          <p className="lede">
            Provider identifiers, their mappings, and whether they answer.
          </p>
        </div>
        <button onClick={refresh} disabled={busy}>
          {busy ? "Checking…" : "Check health"}
        </button>
      </div>
      <div className="notice">
        <span className="notice-icon">i</span>
        <div>
          <strong>Simulation, by design.</strong>
          <p>
            All providers run on this machine. The down Judge intentionally
            returns no verdict. Availability is a transport signal, never a
            quality verdict.
          </p>
        </div>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : (
        <div className="provider-list">
          {Object.entries(mapping).map(([model, url]) => (
            <article className="provider" key={model}>
              <div className="provider-icon">
                {model.includes("subject") ? "S" : "J"}
              </div>
              <div className="provider-description">
                <h2>{model}</h2>
                <code>{url}</code>
                <p>
                  {model.includes("subject")
                    ? "Subject · deterministic support behaviours"
                    : model.includes("blind")
                      ? "Judge · misses unsupported claims"
                      : model.includes("overcall")
                        ? "Judge · flags clean responses"
                        : model.includes("down")
                          ? "Judge · intentionally unavailable"
                          : model.includes("flaky")
                            ? "Judge · recoverable simulator outage"
                            : "Judge · checks recorded content"}
                </p>
              </div>
              <Badge state={health[model] ?? "unknown"}>
                {health[model] ?? (busy ? "checking" : "unknown")}
              </Badge>
            </article>
          ))}
        </div>
      )}
      <p className="footnote">
        Mapping source: config/providers.json, loaded at engine startup. No
        secret_ref is used in Stage 1. Provider health uses the simulator's
        explicit health endpoint (G-1).
      </p>
      <SimulatorControl onChange={() => void refresh()} />
    </>
  );
}

type Selected = { suite: api.Suite; scenario: api.Scenario };
function Explorer() {
  const [focusedResult, setFocusedResult] = useState<string>();
  const [projects, setProjects] = useState<api.Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [records, setRecords] = useState<api.Execution[]>([]);
  const [baselines, setBaselines] = useState<api.Baseline[]>([]);
  const [latestResults, setLatestResults] = useState<
    Record<string, api.Result[]>
  >({});
  const [selected, setSelected] = useState<Selected>();
  const [query, setQuery] = useState("");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>();
  const [refreshCount, setRefreshCount] = useState(0);
  const [updated, setUpdated] = useState("");
  const project = projects.find((p) => p.name === projectName);

  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(undefined);
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          ".drawer button, .drawer summary, .drawer a[href]",
        ),
      ];
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [selected]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError(undefined);
    api
      .projects()
      .then((data) => {
        if (!active) return;
        setProjects(data);
        setProjectName((name) =>
          data.some((p) => p.name === name)
            ? name
            : (data.find((p) => !p.name.startsWith("admission-"))?.name ??
              data[0]?.name ??
              ""),
        );
        if (!data.length) setBusy(false);
      })
      .catch((err) => {
        if (active) {
          setError(err);
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!projectName) return;
    let active = true;
    setBusy(true);
    setError(undefined);
    setRecords([]);
    setBaselines([]);
    setLatestResults({});
    (async () => {
      const [runs, baselineRecords] = await Promise.all([
        api.executions(projectName),
        api.baselines(projectName),
      ]);
      // Presentation ordering only. Do not resolve/aggregate/assess Results here.
      runs.sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      );
      const newest = runs.filter(
        (r, index) =>
          runs.findIndex(
            (other) => other.suite === r.suite && other.scenario === r.scenario,
          ) === index,
      );
      const entries = await Promise.all(
        newest.map(
          async (run) =>
            [run.id, await api.results(projectName, run.id)] as const,
        ),
      );
      if (active) {
        setRecords(runs);
        setBaselines(baselineRecords);
        setLatestResults(Object.fromEntries(entries));
        setUpdated(new Date().toISOString());
      }
    })()
      .catch((err) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [projectName, refreshCount]);

  function latest(suite: string, scenario: string) {
    return records.find((r) => r.suite === suite && r.scenario === scenario);
  }
  const rows =
    project?.suites?.flatMap((suite) =>
      suite.scenarios.map((scenario) => ({ suite, scenario })),
    ) ?? [];
  const visible = rows.filter(
    ({ suite, scenario }) =>
      (suiteFilter === "all" || suite.name === suiteFilter) &&
      `${suite.name} ${scenario.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const chosenRun =
    selected && latest(selected.suite.name, selected.scenario.name);
  const chosenResults = chosenRun ? (latestResults[chosenRun.id] ?? []) : [];
  const chosenBaselines = selected
    ? baselines.filter(
        (b) =>
          b.suite === selected.suite.name &&
          b.scenario === selected.scenario.name,
      )
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROJECT / DEFINITION</p>
          <h1>Test Explorer</h1>
          <p className="lede">Follow the definition. Inspect the evidence.</p>
        </div>
        <button disabled={busy} onClick={() => setRefreshCount((n) => n + 1)}>
          {busy ? "Loading…" : "Refresh from engine"}
        </button>
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : (
        <>
          {projects.length > 0 && (
            <div className="project-strip">
              <div className="project-mark">A</div>
              <div>
                <label htmlFor="project">PROJECT</label>
                <select
                  id="project"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value);
                    setSelected(undefined);
                    setSuiteFilter("all");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="project-meta">
                <Badge>Local simulation</Badge>
                <span>Engine slice-12 · AQEF 1.0-CR1</span>
              </div>
            </div>
          )}
          <div className="intro-grid">
            <div>
              <span className="mini-label">WORKSPACE</span>
              <strong>YAML → Engine → Explorer</strong>
              <p>
                This is a read-only view of the engine. Definitions start in
                your workspace; decisions stay with the engine.
              </p>
            </div>
            <div>
              <span className="mini-label">ENVIRONMENTS</span>
              {project?.environments.map((env) => (
                <div className="environment" key={env.name}>
                  <strong>{env.name}</strong>
                  <code>{env.model_version}</code>
                </div>
              ))}
              <p>Tool configuration: null · simulated artifacts only</p>
            </div>
          </div>
          <div className="section-heading">
            <div>
              <h2>
                Scenarios <span className="count">{rows.length}</span>
              </h2>
              <p>Baseline records and Results are retrieved from the engine.</p>
            </div>
            <Badge>Read only</Badge>
          </div>
          <div className="toolbar">
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search Scenarios"
                placeholder="Find a Scenario or Suite…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="suite-select">
              Suite{" "}
              <select
                aria-label="Filter by Suite"
                value={suiteFilter}
                onChange={(e) => setSuiteFilter(e.target.value)}
              >
                <option value="all">All Suites</option>
                {project?.suites?.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {busy ? (
            <div role="status" className="empty">
              Reading definitions and history from the engine…
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <strong>
                {projects.length
                  ? "No matching Scenarios"
                  : "No Projects loaded"}
              </strong>
              <p>
                {projects.length
                  ? "Try another name or Suite."
                  : "The sample import may not have completed. Check engine startup, then refresh."}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Suite</th>
                    <th>Baseline</th>
                    <th>Latest Result</th>
                    <th>
                      <span className="sr-only">Inspect</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ suite, scenario }) => {
                    const run = latest(suite.name, scenario.name);
                    const resultList = run ? (latestResults[run.id] ?? []) : [];
                    const baseline = baselines.some(
                      (b) =>
                        b.suite === suite.name && b.scenario === scenario.name,
                    );
                    return (
                      <tr key={`${suite.name}/${scenario.name}`}>
                        <td>
                          <button
                            className="scenario-link"
                            onClick={() => setSelected({ suite, scenario })}
                          >
                            {scenario.name}
                          </button>
                          <small>
                            {scenario.dataset
                              ? `Dataset · ${scenario.dataset}`
                              : scenario.seeded_control
                                ? "Seeded Control"
                                : "Fixed Variables"}
                          </small>
                        </td>
                        <td>
                          <span className="suite-name">{suite.name}</span>
                        </td>
                        <td>
                          <Badge state={baseline ? "recorded" : "absent"}>
                            {baseline ? "Recorded · inspect" : "No Baseline"}
                          </Badge>
                        </td>
                        <td>
                          {resultList.length ? (
                            <ResultCounts
                              results={resultList}
                              onEvidence={(r) => {
                                setFocusedResult(r.id);
                                setSelected({ suite, scenario });
                              }}
                            />
                          ) : (
                            <Badge state="not_assessed">
                              {run ? `${run.status} · no Result` : "Not run"}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <button
                            aria-label={`Inspect ${scenario.name}`}
                            className="arrow-button"
                            onClick={() => setSelected({ suite, scenario })}
                          >
                            ↗
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">
            <span>
              {visible.length} of {rows.length} Scenarios
            </span>
            <span>
              {updated
                ? `Read from engine ${time(updated)}`
                : "Waiting for engine"}
            </span>
          </div>
          <div className="quiet-note">
            <strong>No Result is a state, too.</strong>
            <p>
              “Not run” and “No Baseline” do not mean pass. Open Runs and
              Evidence to start a new batch. Admission and Gate decisions remain
              separate.
            </p>
            <span>UI-1 / Foundation</span>
          </div>
        </>
      )}
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(undefined)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scenario-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(undefined);
            }}
          >
            <button
              className="close"
              autoFocus
              onClick={() => setSelected(undefined)}
            >
              Close ×
            </button>
            <p className="eyebrow">SCENARIO / READ ONLY</p>
            <h2 id="scenario-title">{selected.scenario.name}</h2>
            <p>Suite: {selected.suite.name}</p>
            {chosenRun && chosenResults.find((r) => r.id === focusedResult) && (
              <ResultEvidence
                result={chosenResults.find((r) => r.id === focusedResult)!}
                execution={chosenRun}
              />
            )}
            <h3>Definition returned by the engine</h3>
            <Json value={selected.scenario} />
            <h3>Attached Contracts</h3>
            <p>
              Authored attachment levels, as returned by the engine. No
              client-side composition.
            </p>
            <Json
              value={{
                project: project?.contracts,
                suite: selected.suite.contracts,
                scenario: selected.scenario.contract,
              }}
            />
            <h3>Baseline records</h3>
            {chosenBaselines.length ? (
              <>
                <p>
                  These are recorded designations. Their current validity is not
                  evaluated by this screen; inspect their configuration and
                  Environment.
                </p>
                <Json value={chosenBaselines} />
              </>
            ) : (
              <p>
                No Baseline has been recorded for this Scenario in this Suite.
              </p>
            )}
            <h3>Latest Execution</h3>
            {chosenRun ? (
              <>
                <p>
                  Environment: {chosenRun.environment} ·{" "}
                  {time(chosenRun.created_at)}
                </p>
                <Json value={chosenRun} />
                <h3>Results returned by the engine</h3>
                {chosenResults.length ? (
                  <ResultEntries
                    results={chosenResults}
                    onEvidence={(r) => {
                      setFocusedResult(r.id);
                      document.querySelector(".drawer")?.scrollTo({ top: 0 });
                    }}
                  />
                ) : (
                  <p>No Results recorded for this Execution.</p>
                )}
              </>
            ) : (
              <p>Not run. No verdict or Confidence is available.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function App() {
  const route = () => {
    const value = location.hash.slice(1),
      prefix = value.split("/")[0];
    return [
      "runs",
      "controls",
      "admission",
      "gates",
      "reports",
      "report",
      "dashboard",
      "releases",
      "result",
      "metric",
    ].includes(prefix) ||
      [
        "connections",
        "workspace",
        "designer",
        "validators",
        "judges",
        "control-designer",
      ].includes(value)
      ? value
      : "explorer";
  };
  const [page, setPage] = useState(route());
  useEffect(() => {
    const handler = () => setPage(route());
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  if (page.startsWith("report/"))
    return <ReportDocument key={page} route={page} />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#explorer">
          <span className="brand-mark">a</span>
          <div>
            AQEF<span>REFERENCE UI</span>
          </div>
        </a>
        <div className="local-status">
          <span /> LOCAL WORKSPACE
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <a
            href="#admission"
            className={page.startsWith("admission") ? "active" : ""}
          >
            <span>✓</span>Admission
          </a>
          <a
            href="#controls"
            className={page.startsWith("controls") ? "active" : ""}
          >
            <span>◈</span>Seeded Controls
          </a>
          <a className={page === "workspace" ? "active" : ""} href="#workspace">
            <span>≡</span>Workspace
          </a>
          <a className={page === "designer" ? "active" : ""} href="#designer">
            <span>◇</span>Visual Test Designer
          </a>
          <a
            className={page === "validators" ? "active" : ""}
            href="#validators"
          >
            <span>✓</span>Validator Designer
          </a>
          <a className={page === "judges" ? "active" : ""} href="#judges">
            <span>◇</span>Judge Configuration
          </a>
          <a className={page === "explorer" ? "active" : ""} href="#explorer">
            <span>▦</span>Test Explorer
          </a>
          <a className={page.startsWith("runs") ? "active" : ""} href="#runs">
            <span>▷</span>Runs and Evidence
          </a>
          <a href="#gates" className={page.startsWith("gates") ? "active" : ""}>
            <span>◇</span>Gates
          </a>
          <a
            href="#reports"
            className={page.startsWith("reports") ? "active" : ""}
          >
            <span>▤</span>Reports
          </a>
          <a
            href="#dashboard"
            className={page.startsWith("dashboard") ? "active" : ""}
          >
            <span>⌁</span>Dashboard
          </a>
          <a
            href="#releases"
            className={page.startsWith("releases") ? "active" : ""}
          >
            <span>✓</span>Release Decisions
          </a>
          <a
            className={page === "connections" ? "active" : ""}
            href="#connections"
          >
            <span>⌁</span>Connections
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">STAGE 1 · UI-6</span>
          <p>
            Definitions first.
            <br />
            Evidence always.
          </p>
          <div>
            Local · single user
            <br />
            Simulated providers
          </div>
        </div>
        <footer>
          AQEF 1.0-CR1<span>Reference implementation</span>
        </footer>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span>{" "}
            {
              {
                explorer: "Test Explorer",
                connections: "Connections",
                workspace: "Workspace",
                designer: "Visual Test Designer",
                validators: "Validator Designer",
                judges: "Judge Configuration",
                runs: "Runs and Evidence",
                admission: "Admission",
                gates: "Gates",
                reports: "Reports",
                dashboard: "Dashboard",
                releases: "Release Decisions",
                result: "Result Evidence",
                metric: "Metric Evidence",
                controls: "Seeded Controls",
                "control-designer": "Control Scenario Designer",
              }[page.split("/")[0]]
            }
          </span>
          <div>
            <span className="local-dot" /> Local only{" "}
            <span className="avatar" title="Local bootstrap Person">
              A
            </span>
          </div>
        </header>
        <main>
          <div
            hidden={
              ![
                "workspace",
                "designer",
                "validators",
                "judges",
                "control-designer",
              ].includes(page)
            }
          >
            <WorkspaceScreen
              mode={
                page === "designer" ||
                page === "validators" ||
                page === "judges" ||
                page === "control-designer"
                  ? page
                  : "workspace"
              }
            />
          </div>
          {page === "connections" ? (
            <Connections />
          ) : page === "explorer" ? (
            <Explorer />
          ) : page.startsWith("runs") ? (
            <RunsScreen route={page} />
          ) : page.startsWith("admission") ? (
            <AdmissionScreen key={page} route={page} />
          ) : page.startsWith("controls") ? (
            <ControlsScreen route={page} />
          ) : page.startsWith("gates") ? (
            <GatesScreen key={page} route={page} />
          ) : page.startsWith("reports") ? (
            <ReportsScreen key={page} route={page} />
          ) : page.startsWith("dashboard") ? (
            <Dashboard key={page} route={page} />
          ) : page.startsWith("releases") ? (
            <ReleasesScreen key={page} route={page} />
          ) : page.startsWith("result/") ? (
            <ResultLocator key={page} route={page} />
          ) : page.startsWith("metric/") ? (
            <MetricEvidence key={page} route={page} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
