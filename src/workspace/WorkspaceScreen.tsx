import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Designer } from "./Designer";
import { YamlEditor } from "./YamlEditor";
import { FileTree } from "./FileTree";
import { ValidatorDesigner } from "./ValidatorDesigner";
import { ControlDesigner } from "./ControlDesigner";
import { JudgeDesigner } from "./JudgeDesigner";
import { oracleChecks } from "./oracleRules";
import { providers as readProviders } from "../api";
import type { Data } from "./model";
import {
  assemble,
  diffText,
  parseSource,
  secretKeys,
  type Source,
} from "./model";
import {
  applyPlan,
  exportEngine,
  makePlan,
  readAll,
  type Outcome,
  type Plan,
} from "./api";

export function WorkspaceScreen({
  mode,
}: {
  mode: "workspace" | "designer" | "validators" | "judges" | "control-designer";
}) {
  const [providerMap, setProviderMap] = useState<Record<string, string>>({}),
    [handoff, setHandoff] = useState<Data>();
  const previousMode = useRef(mode),
    loadSequence = useRef(0);
  const [sources, setSources] = useState<Source[]>([]),
    [active, setActive] = useState(""),
    [draft, setDraft] = useState("");
  const [visual, setVisual] = useState<string>(),
    [formError, setFormError] = useState(""),
    [error, setError] = useState("");
  const [plan, setPlan] = useState<Plan>(),
    [intent, setIntent] = useState<"apply" | "export">("apply");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]),
    [state, setState] = useState(""),
    [busy, setBusy] = useState(false),
    [generation, setGeneration] = useState(0);
  const original = sources.find((s) => s.path === active);
  const effective = mode !== "workspace" ? (visual ?? draft) : draft;
  const editedSources = useMemo(
    () =>
      sources.map((s) =>
        s.path === active ? { ...s, content: effective } : s,
      ),
    [sources, active, effective],
  );
  const validation = useMemo(() => {
    try {
      const assembled = assemble(editedSources),
        checks = oracleChecks(
          assembled.roots,
          assembled.resources,
          providerMap,
        );
      return {
        issues: [...assembled.issues, ...checks.blocks],
        sensitive: false,
        roots: assembled.roots,
        warnings: checks.warnings,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        issues: [message],
        sensitive: message.includes("Sensitive key") || secretKeys(effective),
        roots: new Map<string, Data>(),
        warnings: [] as string[],
      };
    }
  }, [editedSources, providerMap]);
  const sensitive =
    validation.sensitive || formError.startsWith("Sensitive key");
  async function reload(path = active) {
    const sequence = ++loadSequence.current;
    setBusy(true);
    setError("");
    try {
      const [files, mapping] = await Promise.all([readAll(), readProviders()]);
      if (sequence !== loadSequence.current) return;
      setProviderMap(mapping);
      setSources(files);
      const file =
        files.find((f) => f.path === path) ??
        files.find((f) => f.path === "project.yaml") ??
        files[0];
      setActive(file?.path ?? "");
      setDraft(file?.content ?? "");
      setVisual(undefined);
      setFormError("");
      setGeneration((n) => n + 1);
      setPlan(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (sequence === loadSequence.current) setBusy(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (previousMode.current !== mode) {
      if (visual !== undefined) {
        setDraft(visual);
        setVisual(undefined);
      }
      setFormError("");
      setGeneration((value) => value + 1);
      previousMode.current = mode;
    }
    setPlan(undefined);
  }, [mode]);
  useEffect(() => {
    setPlan(undefined);
  }, [effective, formError]);
  const handleFormError = useCallback((message: string) => {
    setFormError(message);
    if (message) setVisual(undefined);
  }, []);
  useEffect(() => {
    const receive = (event: Event) => {
      const e = event as CustomEvent<{ path: string; content: string }>;
      if (
        original &&
        effective !== original.content &&
        !window.confirm(
          "Discard the unsaved workspace draft to review this generated source?",
        )
      ) {
        e.preventDefault();
        return;
      }
      ++loadSequence.current;
      setBusy(true);
      void readAll()
        .then((files) => {
          const source = files.find((s) => s.path === e.detail.path) ?? {
            path: e.detail.path,
            content: "",
            etag: null,
          };
          setSources(
            files.some((s) => s.path === source.path)
              ? files
              : [...files, source],
          );
          setActive(source.path);
          setDraft(e.detail.content);
          setVisual(undefined);
          setFormError("");
          setPlan(undefined);
          setGeneration((n) => n + 1);
        })
        .catch((err) => setError(String(err)))
        .finally(() => setBusy(false));
    };
    window.addEventListener("aqef-propose-source", receive);
    return () => window.removeEventListener("aqef-propose-source", receive);
  }, [sources, original, effective]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (original && effective !== original.content) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [effective, original]);
  function choose(source: Source) {
    if (
      original &&
      effective !== original.content &&
      !window.confirm("Discard the unsaved draft for this file?")
    )
      return false;
    setActive(source.path);
    setDraft(source.content);
    setVisual(undefined);
    setFormError("");
    setPlan(undefined);
    setGeneration((n) => n + 1);
    return true;
  }
  async function preview(exporting = false) {
    setBusy(true);
    setError("");
    setOutcomes([]);
    setState("");
    setPlan(undefined);
    try {
      if (sensitive)
        throw new Error(
          "Use secret_ref; sensitive draft content is hidden and cannot be saved or applied.",
        );
      if (!exporting && mode !== "workspace" && formError)
        throw new Error(formError);
      const candidate = exporting ? await exportEngine(sources) : editedSources;
      const next = await makePlan(candidate);
      if (exporting && next.operations.length)
        throw new Error(
          "Export would not round-trip without engine changes; no files were written.",
        );
      setIntent(exporting ? "export" : "apply");
      setPlan(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const result = await applyPlan(
        intent === "export" ? { ...plan, operations: [] } : plan,
        sources,
      );
      setState(`${intent === "export" ? "Export" : "Apply"} ${result.state}`);
      setOutcomes(result.outcomes);
      await reload(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  const yamlDiff = sensitive
    ? "Sensitive draft hidden; use secret_ref."
    : mode !== "workspace" && formError
      ? formError
      : diffText(original?.content ?? "", effective);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">AUTHORING / YAML SOURCE OF TRUTH</p>
          <h1>
            {
              {
                workspace: "Workspace",
                designer: "Visual Test Designer",
                validators: "Validator Designer",
                judges: "Judge Configuration",
                "control-designer": "Control Scenario Designer",
              }[mode]
            }
          </h1>
          <p className="lede">
            Propose YAML. Review the diff. Let the engine decide.
          </p>
        </div>
        <div className="button-row">
          <button disabled={busy} onClick={() => reload()}>
            Reload files
          </button>
          <button
            disabled={busy || !sources.length}
            onClick={() => preview(true)}
          >
            Export engine configuration
          </button>
        </div>
      </div>
      <div className="workspace-layout">
        <aside className="file-tree" aria-label="YAML file tree">
          <strong>./workspace</strong>
          <FileTree sources={sources} active={active} onChoose={choose} />
          <button
            onClick={() => {
              const path = window.prompt(
                "Relative YAML filename, for example project-new.yaml",
              );
              if (!path) return;
              if (sources.some((s) => s.path === path)) {
                setError("That file already exists. Select it in the tree.");
                return;
              }
              const source = { path, content: "", etag: null };
              if (choose(source)) setSources((old) => [...old, source]);
            }}
          >
            + New YAML file
          </button>
        </aside>
        <div className="workspace-content">
          <div className="editor-heading">
            <strong>{active || "No YAML file selected"}</strong>
            <nav aria-label="Authoring mode">
              <a
                href="#workspace"
                aria-current={mode === "workspace" ? "page" : undefined}
              >
                YAML editor
              </a>
              <a
                href="#designer"
                aria-current={mode === "designer" ? "page" : undefined}
              >
                Visual forms
              </a>
            </nav>
          </div>
          {!original ? (
            <p role="status">Loading YAML files…</p>
          ) : sensitive ? (
            <div role="alert" className="error">
              Sensitive draft hidden. Use secret_ref. Reload files to discard
              this draft.
            </div>
          ) : mode === "designer" ? (
            <Designer
              key={`${active}:${generation}`}
              content={draft}
              onChange={setVisual}
              onError={handleFormError}
            />
          ) : mode === "validators" ? (
            <ValidatorDesigner
              key={`${active}:${generation}`}
              content={draft}
              roots={validation.roots}
              providers={providerMap}
              onChange={setVisual}
              onError={handleFormError}
              onHandoff={(data) => {
                setHandoff(data);
                window.location.hash = "judges";
              }}
            />
          ) : mode === "control-designer" ? (
            <ControlDesigner
              key={`${active}:${generation}`}
              content={draft}
              onChange={setVisual}
              onError={handleFormError}
            />
          ) : mode === "judges" ? (
            <JudgeDesigner
              key={`${active}:${generation}`}
              content={draft}
              roots={validation.roots}
              providers={providerMap}
              onChange={setVisual}
              onError={handleFormError}
              prefill={handoff}
            />
          ) : (
            <YamlEditor value={draft} onChange={setDraft} />
          )}
          <section className="schema-status" aria-label="Schema checks">
            <strong>
              {validation.issues.length
                ? "Authoring checks need attention"
                : "Authoring schema checks passed"}
            </strong>
            <p>
              AQEF 1.0-CR1 A.1–A.10 / B.2 authoring subset. Cross-resource rules
              and all acceptance remain engine-authoritative.
            </p>
            {validation.issues.length > 0 && (
              <ul>
                {validation.issues.slice(0, 30).map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            )}
            {mode !== "workspace" && formError && <p>{formError}</p>}
            {/action_boundary:|validator:\s*(boundary|tool-call)/.test(
              effective,
            ) && (
              <span className="badge">
                At Risk in 1.0-CR1 · Action Boundary / acting tools
              </span>
            )}
          </section>
          <details className="defaults-note">
            <summary>
              Documented engine defaults (comparison only; never inserted into
              authored YAML)
            </summary>
            <p>
              Absent collection fields are compared as empty lists; Constraint
              veto is false and its dimension follows the Validator type;
              Expectation dimension is semantic and on_timeout is block;
              Policies composition is AND; Gate require_admitted_judges is
              false. Execution settings preserve omission for Project/Suite
              inheritance. Human Confidence capture is false. Voting threshold
              is majority and disagreement routes to human_review when omitted.
              These are the pinned engine's documented defaults. Explicit null
              is preserved and sent for engine validation.
            </p>
          </details>
          <h2>YAML diff · before saving</h2>
          <pre className="diff" aria-label="YAML diff">
            {yamlDiff}
          </pre>
          <button
            className="primary"
            disabled={
              busy ||
              !active ||
              sensitive ||
              (mode !== "workspace" && Boolean(formError))
            }
            onClick={() => preview()}
          >
            Review &amp; Apply
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          <strong>Apply preview refused</strong>
          <pre>{error}</pre>
        </div>
      )}
      {plan && (
        <section className="apply-preview" aria-label="Apply preview">
          <h2>{intent === "export" ? "Export preview" : "Apply preview"}</h2>
          {plan.warnings.map((warning, index) => (
            <p key={index} className="notice" role="note">
              {warning}
            </p>
          ))}
          <p>
            {plan.changes.filter((c) => c.kind !== "unchanged").length} changed
            or created resources · {plan.operations.length} engine calls. No
            engine write has been issued.
          </p>
          {plan.issues.length > 0 && (
            <div className="notice">
              Schema warnings are present. They are advisory here; only the
              engine can accept the configuration.
            </div>
          )}
          {plan.changes.map((change, index) => (
            <details key={index} open={change.kind !== "unchanged"}>
              <summary>
                <span
                  className={`badge ${change.kind === "unchanged" ? "neutral" : "recorded"}`}
                >
                  {change.kind}
                </span>{" "}
                {change.resource}{" "}
                {change.governed && (
                  <span className="badge governed">
                    Governed · contract_define / Approval Workflow
                  </span>
                )}
              </summary>
              <p>{change.call}</p>
              {change.diff && <pre className="diff">{change.diff}</pre>}
            </details>
          ))}
          {plan.sources
            .filter(
              (source) =>
                source.content !==
                sources.find((s) => s.path === source.path)?.content,
            )
            .map((source) => (
              <details key={source.path} open>
                <summary>YAML file: {source.path}</summary>
                <pre className="diff">
                  {diffText(
                    sources.find((s) => s.path === source.path)?.content ?? "",
                    source.content,
                  )}
                </pre>
              </details>
            ))}
          <h3>Calls in dependency order</h3>
          {plan.operations.length ? (
            <ol>
              {plan.operations.map((operation, index) => (
                <li key={index}>
                  {operation.method} {operation.path}
                  {operation.governed
                    ? " · Governed · Person approval recorded by the engine"
                    : ""}
                  {operation.note && <p>{operation.note}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>No engine changes.</p>
          )}
          <p>
            Confirmation saves the reviewed YAML through the workspace file
            service. Engine calls follow; every outcome is reported. A rejection
            keeps the YAML source and does not pretend the engine accepted it.
            No automatic rollback is attempted.
          </p>
          <button className="primary" disabled={busy} onClick={confirm}>
            {intent === "export" ? "Confirm Export" : "Confirm Apply"}
          </button>
          <button disabled={busy} onClick={() => setPlan(undefined)}>
            Cancel preview
          </button>
        </section>
      )}
      {state && (
        <section
          className={`apply-outcome ${state.includes("failed") || state.includes("partial") ? "error" : "notice"}`}
          role="status"
        >
          <div>
            <h2>{state}</h2>
            {outcomes.length ? (
              outcomes.map((outcome, index) => (
                <div key={index}>
                  <strong>
                    {outcome.status} · {outcome.call}
                  </strong>
                  <pre>{outcome.message}</pre>
                </div>
              ))
            ) : (
              <p>No calls were needed.</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
