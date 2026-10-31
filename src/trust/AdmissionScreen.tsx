import { useEffect, useState } from "react";
import { parseAllDocuments, stringify } from "yaml";
import { projects as readProjects } from "../api";
import {
  collection,
  request,
  projectPath,
  localPerson,
  type RecordData,
} from "../runs/api";
import { Failure, Raw } from "../runs/ExecutionView";
import { readAll, readFile, writeFile } from "../workspace/api";
import {
  contractsIn,
  judgeMembers,
  judgeIdentity,
  NEW_JUDGE_WARNING,
} from "../workspace/oracleRules";
import { SelectField, InputField } from "../workspace/OracleFields";
import { agreement, excluded, propose } from "./model";
import { canonical } from "../workspace/model";

export function AdmissionScreen() {
  const [projects, setProjects] = useState<RecordData[]>([]),
    [project, setProject] = useState(""),
    [oracle, setOracle] = useState(""),
    [refs, setRefs] = useState<RecordData[]>([]),
    [refKey, setRefKey] = useState(""),
    [plans, setPlans] = useState<RecordData[]>([]),
    [plan, setPlan] = useState<RecordData>(),
    [records, setRecords] = useState<RecordData[]>([]),
    [person, setPerson] = useState<RecordData>(),
    [measure, setMeasure] = useState(""),
    [threshold, setThreshold] = useState(""),
    [environment, setEnvironment] = useState(""),
    [arbitrations, setArbitrations] = useState(""),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const root = projects.find((p) => p.name === project),
    ref = refs.find((r) => r.key === refKey);
  const candidates = new Map<string, string>();
  for (const entry of contractsIn(root ?? {}))
    for (const clause of entry.value.expectations ?? [])
      for (const judge of judgeMembers(clause))
        candidates.set(
          judgeIdentity(judge, clause.criteria),
          `${judge.model} · ${clause.criteria}`,
        );
  for (const record of records) candidates.set(record.oracle, record.oracle);
  async function refreshFiles() {
    const files = await readAll();
    const references: RecordData[] = [],
      saved: RecordData[] = [];
    for (const file of files)
      for (const [i, doc] of parseAllDocuments(file.content).entries()) {
        const data = doc.toJS();
        if (data?.items && data.name && data.version)
          references.push({ ...data, key: file.path + ":" + i });
        if (data?.admission_plan)
          saved.push({
            ...data.admission_plan,
            path: file.path,
            _etag: file.etag,
          });
      }
    setRefs(references);
    setPlans(saved);
  }
  useEffect(() => {
    readProjects()
      .then((rows) => {
        setProjects(rows);
        setProject(
          rows.find((p) => !p.name.startsWith("admission-"))?.name ?? "",
        );
      })
      .catch(setError);
    refreshFiles().catch(setError);
    localPerson().then(setPerson).catch(setError);
  }, []);
  useEffect(() => {
    if (project)
      collection<RecordData>(projectPath(project) + "/admissions")
        .then(setRecords)
        .catch(setError);
  }, [project]);
  async function save(next: RecordData): Promise<RecordData> {
    const path = next.path;
    let current;
    try {
      current = await readFile(path);
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }
    if (current && next._etag !== current.etag)
      throw new Error(
        "Declaration changed on disk; resume its latest version before editing.",
      );
    const { _etag, ...stored } = next;
    const written = await writeFile({
      path,
      content: stringify({ admission_plan: stored }),
      etag: current?.etag ?? null,
    });
    const updated: RecordData = { ...stored, _etag: written.etag };
    setPlan(updated);
    await refreshFiles();
    return updated;
  }
  async function guard(work: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const validThreshold =
    threshold.trim() !== "" && Number.isFinite(Number(threshold));
  async function declare() {
    await guard(async () => {
      if (!root || !ref || !oracle || !person || !measure || !validThreshold)
        throw new Error(
          "Choose configuration, Reference Set, measure and a finite threshold before any results.",
        );
      const config = JSON.parse(oracle);
      if (
        config.type !== "judge" ||
        !config.model ||
        !config.criteria ||
        !config.confidence_source
      )
        throw new Error(
          "Choose an exact Single Judge configuration; panels are admitted member by member.",
        );
      const items = ref.items.filter(
        (item: RecordData) => !excluded(item, oracle),
      );
      if (
        !items.length ||
        new Set(items.map((i: RecordData) => i.id)).size !== items.length ||
        items.some(
          (i: RecordData) =>
            !["pass", "fail"].includes(i.label) ||
            !i.evidence?.conversation?.turns?.length ||
            !(i.labelled_by ?? ref.labelled_by)?.length,
        )
      )
        throw new Error(
          "Reference Set needs unique items, fixed Evidence, pass/fail labels and labelling Persons.",
        );
      const id = crypto.randomUUID();
      await save({
        id,
        path: `admissions/plans/${id}.yaml`,
        project,
        oracle,
        reference_set: ref.name + "@" + ref.version,
        reference_snapshot: ref,
        items,
        excluded_ids: ref.items
          .filter((i: RecordData) => excluded(i, oracle))
          .map((i: RecordData) => i.id),
        measure,
        declared_threshold: Number(threshold),
        threshold: Number(threshold),
        declared_at: new Date().toISOString(),
        declared_by: person.id,
        results_seen: false,
        threshold_changed_after_results: false,
        diagnostic_project: "admission-" + id,
        suite: "reference-items",
      });
    });
  }
  async function updateThreshold() {
    if (!plan || !validThreshold || Number(threshold) === plan.threshold)
      return;
    await guard(async () => {
      await save({
        ...plan,
        threshold: Number(threshold),
        threshold_changed_after_results:
          plan.threshold_changed_after_results || plan.results_seen,
        threshold_history: [
          ...(plan.threshold_history ?? []),
          {
            value: Number(threshold),
            at: new Date().toISOString(),
            person: person?.id,
            after_results: plan.results_seen,
          },
        ],
      });
    });
  }
  async function generate() {
    await guard(async () => {
      if (!plan || !environment || !root)
        throw new Error("Choose the Environment for fixed-Evidence execution.");
      const env = root.environments.find(
          (e: RecordData) => e.name === environment,
        ),
        config = JSON.parse(plan.oracle);
      const scenarios = plan.items.map((item: RecordData, index: number) => ({
        name: item.id,
        seeded_control: {
          kind: item.label === "fail" ? "defect" : "clean",
          defect_class: "admission_item_" + index,
          confirmed_by: "construction",
          ...(item.label === "fail"
            ? {
                planted_defect:
                  "Declared Reference Set failing grounding label",
              }
            : {}),
        },
        evidence: item.evidence,
        contract: {
          expectations: [
            {
              id: "reference-grounding",
              criteria: config.criteria,
              confidence_threshold: 0,
              defect_classes: ["admission_item_" + index],
              judge: {
                model: config.model,
                confidence_source: config.confidence_source,
              },
            },
          ],
        },
      }));
      const definition = {
        project: {
          name: plan.diagnostic_project,
          environments: [env],
          suites: [{ name: plan.suite, scenarios }],
        },
      };
      const next = await save({
        ...plan,
        environment,
        generated_definition: definition,
        generated_path: `admissions/suites/${plan.id}.yaml`,
      });
      propose(next.generated_path, stringify(definition));
    });
  }
  async function run() {
    await guard(async () => {
      if (!plan?.generated_definition)
        throw new Error("Generate and review the dedicated Suite first.");
      const live = await request(projectPath(plan.diagnostic_project));
      const suite = live.suites.find((s: RecordData) => s.name === plan.suite);
      if (
        suite?.scenarios.length !== plan.items.length ||
        suite.scenarios.some(
          (s: RecordData) =>
            !s.evidence ||
            !plan.items.some(
              (item: RecordData) =>
                item.id === s.name &&
                canonical({
                  conversation: item.evidence.conversation,
                  artifacts: item.evidence.artifacts ?? {},
                }) ===
                  canonical({
                    conversation: s.evidence.conversation,
                    artifacts: s.evidence.artifacts ?? {},
                  }),
            ) ||
            s.prompt ||
            s.dataset ||
            s.variables ||
            judgeIdentity(
              s.contract.expectations[0].judge,
              s.contract.expectations[0].criteria,
            ) !== plan.oracle,
        )
      )
        throw new Error(
          "The applied diagnostic Suite differs from the declared fixed-Evidence configuration; review it again.",
        );
      const batch = await request(
        projectPath(plan.diagnostic_project) + "/executions",
        { suite: plan.suite, environment: plan.environment },
      );
      await save({
        ...plan,
        batch_id: batch.execution_batch_id,
        executions: batch.executions.map((e: RecordData) => ({
          id: e.id,
          scenario: e.scenario,
          status: e.status,
        })),
      });
    });
  }
  async function compute() {
    await guard(async () => {
      if (!plan?.executions)
        throw new Error("Run the Reference Set after the declaration.");
      const scores = [];
      for (const e of plan.executions) {
        const rows = await collection<RecordData>(
          projectPath(plan.diagnostic_project) +
            "/executions/" +
            e.id +
            "/results",
        );
        const result = rows.find(
          (r) => r.oracle === plan.oracle && r.clause === "reference-grounding",
        );
        scores.push({
          item: e.scenario,
          execution: e.id,
          result_id: result?.id ?? "not returned",
          verdict: result?.verdict ?? null,
          disposition: result?.disposition ?? e.status,
        });
      }
      await save({
        ...plan,
        results_seen: true,
        scores,
        computed_at: new Date().toISOString(),
      });
    });
  }
  const figures = plan?.results_seen
    ? agreement(plan.items, plan.scores)
    : undefined;
  async function record() {
    await guard(async () => {
      if (!plan || !figures || figures.raw === null)
        throw new Error(
          "Unscored items cannot supply the numeric raw_agreement required by the engine; no Admission submitted.",
        );
      let next: RecordData = {
        ...plan,
        threshold: Number(threshold),
        threshold_changed_after_results:
          plan.threshold_changed_after_results ||
          Number(threshold) !== plan.threshold,
        threshold_history: [
          ...(plan.threshold_history ?? []),
          ...(Number(threshold) !== plan.threshold
            ? [
                {
                  value: Number(threshold),
                  at: new Date().toISOString(),
                  person: person?.id,
                  after_results: true,
                },
              ]
            : []),
        ],
      };
      next = await save(next);
      const labels = [
        ...new Set(
          plan.items.flatMap(
            (i: RecordData) =>
              i.labelled_by ?? plan.reference_snapshot.labelled_by,
          ),
        ),
      ];
      const body = {
        oracle: plan.oracle,
        reference_set: plan.reference_set,
        items: figures.n,
        verdict_distribution: { pass: figures.hp, fail: figures.hf },
        raw_agreement: figures.raw,
        measure: plan.measure,
        chance_corrected_agreement: figures.kappa,
        threshold: Number(threshold),
        admitted:
          figures.kappa !== "not_computed" &&
          figures.kappa >= Number(threshold),
        labelled_by: labels,
        arbitrations: arbitrations
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const accepted = await request(
        projectPath(plan.project) + "/admissions",
        body,
      );
      await save({
        ...next,
        accepted_records: [...(plan.accepted_records ?? []), accepted.id],
      });
      setRecords(
        await collection<RecordData>(projectPath(plan.project) + "/admissions"),
      );
    });
  }
  return (
    <div className="trust-screen">
      <div className="page-heading">
        <div>
          <p className="eyebrow">S-7 / PERSON-REVIEWED AGREEMENT EVIDENCE</p>
          <h1>Admission</h1>
        </div>
        <button
          onClick={() => {
            setPlan(undefined);
            setThreshold("");
            setOracle("");
            setRefKey("");
            setMeasure("");
          }}
        >
          New workflow
        </button>
      </div>
      {Boolean(error) && <Failure error={error} />}
      {busy && (
        <p role="status">Waiting for the workspace or engine operation…</p>
      )}
      <SelectField
        label="Admission Project"
        value={project}
        choices={projects
          .filter((p) => !p.name.startsWith("admission-"))
          .map((p) => p.name)}
        onChange={(value) => {
          setProject(value);
          setPlan(undefined);
          setOracle("");
        }}
      />
      <SelectField
        label="Resume declaration"
        value={plan?.id ?? ""}
        choices={plans
          .filter((p) => p.project === project)
          .map((p) => [p.id, p.reference_set + " · " + p.id])}
        onChange={(id) => {
          const p = plans.find((p) => p.id === id);
          setPlan(p);
          if (p) {
            setThreshold(String(p.threshold));
            setOracle(p.oracle);
            setEnvironment(p.environment ?? "");
          }
        }}
      />
      <ol className="workflow-steps" aria-label="Admission stepper">
        {[
          "Choose configuration and Reference Set",
          "Declare measure and threshold",
          "Apply and run fixed Evidence",
          "Inspect agreement arithmetic",
          "Record Admission",
        ].map((label, i) => (
          <li
            key={label}
            aria-current={
              plan
                ? (
                    plan.results_seen
                      ? i === 4
                      : plan.batch_id
                        ? i === 3
                        : i === 2
                  )
                  ? "step"
                  : undefined
                : i === 0
                  ? "step"
                  : undefined
            }
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {oracle && (
        <p aria-label="Selected Admission status">
          Selected exact configuration:{" "}
          {(() => {
            const latest = records.filter((r) => r.oracle === oracle).at(-1);
            return latest
              ? latest.admitted
                ? "admitted"
                : "not admitted"
              : "no record";
          })()}
        </p>
      )}
      {!plan ? (
        <section className="designer-form">
          <h2>1. Choose</h2>
          <SelectField
            label="Judge configuration (exact Oracle)"
            value={oracle}
            choices={[...candidates].map(([id, label]) => [id, label])}
            onChange={setOracle}
          />
          <InputField
            label="Exact Oracle string (including historical configuration)"
            value={oracle}
            onChange={setOracle}
            rows={3}
          />
          <p>{NEW_JUDGE_WARNING}</p>
          <SelectField
            label="Reference Set version"
            value={refKey}
            choices={refs.map((r) => [r.key, r.name + "@" + r.version])}
            onChange={setRefKey}
          />
          {ref && oracle && (
            <p>
              {
                ref.items.filter((i: RecordData) => {
                  try {
                    return excluded(i, oracle);
                  } catch {
                    return false;
                  }
                }).length
              }{" "}
              exposed items excluded for this configuration.
            </p>
          )}
          <p className="notice">
            SHOULD: use independent, blind labelling and recorded arbitration.
            The illustrative sample has one declared labeller; this is a note,
            not a block. Review provenance before submitting.
          </p>
          <h2>2. Declare before results</h2>
          <SelectField
            label="Chance-corrected measure"
            value={measure}
            choices={[["cohen_kappa", "Cohen’s κ (cohen_kappa)"]]}
            onChange={setMeasure}
          />
          <InputField
            label="Declared threshold"
            value={threshold}
            onChange={setThreshold}
          />
          <button
            className="primary"
            disabled={busy || !oracle || !ref || !measure || !validThreshold}
            onClick={() => void declare()}
          >
            Record declaration
          </button>
        </section>
      ) : (
        <>
          <section className="run-control">
            <h2>Declared workflow {plan.id}</h2>
            <p>
              {plan.reference_set} · {plan.items.length} included ·{" "}
              {plan.excluded_ids.length} exposed items excluded
            </p>
            <p>
              Declared by {plan.declared_by} at {plan.declared_at};{" "}
              {plan.measure}, threshold {plan.declared_threshold}.
            </p>
            <details>
              <summary>Declaration and exact configuration</summary>
              <Raw value={plan} />
            </details>
            <h2>3. Apply, then run</h2>
            <p>
              The pin accepts fixed Evidence only on construction Seeded
              Controls. This diagnostic Suite therefore runs in an isolated
              Project, one isolated class per item, to avoid contaminating
              product controls or failing fast after a diagnostic miss. It calls
              no subject. Explicit diagnostic Judge Confidence threshold 0
              collects verdicts; it is not the declared agreement threshold.
            </p>
            <SelectField
              label="Diagnostic Environment"
              value={environment}
              choices={(root?.environments ?? []).map(
                (e: RecordData) => e.name,
              )}
              onChange={setEnvironment}
            />
            <button
              disabled={busy || !environment}
              onClick={() => void generate()}
            >
              Generate Suite → Review & Apply
            </button>
            <p>Return here and resume this declaration after Confirm Apply.</p>
            <button
              disabled={busy || !plan.generated_definition || plan.results_seen}
              onClick={() => void run()}
            >
              Run declared Reference Set
            </button>
            {plan.batch_id && (
              <p>
                Batch {plan.batch_id}; {plan.executions.length} Executions. No
                verdicts shown before the declared threshold.
              </p>
            )}
            <button
              disabled={busy || !plan.batch_id || plan.results_seen}
              onClick={() => void compute()}
            >
              Compute and show agreement
            </button>
          </section>
          {figures && (
            <section
              className="agreement-arithmetic"
              aria-label="Agreement arithmetic"
            >
              <h2>4. Agreement arithmetic</h2>
              <table>
                <thead>
                  <tr>
                    <th>Human / Judge</th>
                    <th>Judge pass</th>
                    <th>Judge fail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Human pass</th>
                    <td>{figures.table[0][0]}</td>
                    <td>{figures.table[0][1]}</td>
                  </tr>
                  <tr>
                    <th>Human fail</th>
                    <td>{figures.table[1][0]}</td>
                    <td>{figures.table[1][1]}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                Human verdict distribution: pass {figures.hp}, fail {figures.hf}
                ; Judge distribution: pass {figures.jp}, fail {figures.jf}; N ={" "}
                {figures.n}.
              </p>
              <p>
                Raw agreement Pₒ = (pass/pass + fail/fail) / N = (
                {figures.table[0][0]} + {figures.table[1][1]}) / {figures.n} ={" "}
                {String(figures.raw ?? "not_computed")}.
              </p>
              <p>
                Expected chance Pₑ = (human pass × Judge pass + human fail ×
                Judge fail) / N² = ({figures.hp} × {figures.jp} + {figures.hf} ×{" "}
                {figures.jf}) / {figures.n}² ={" "}
                {String(figures.expected ?? "not_computed")}.
              </p>
              <p>
                Cohen’s κ = (Pₒ − Pₑ) / (1 − Pₑ) = ({String(figures.raw)} −{" "}
                {String(figures.expected)}) / (1 − {String(figures.expected)}) ={" "}
                <strong data-testid="kappa">{figures.kappa}</strong>.
              </p>
              {figures.kappa === "not_computed" && (
                <p>
                  not_computed: insufficient scored variation or missing
                  verdicts; proposed admitted is false.
                </p>
              )}
              <p>
                Proposed admitted = value ≥ declared threshold ={" "}
                {figures.kappa === "not_computed"
                  ? "not_computed"
                  : figures.kappa}{" "}
                ≥ {threshold}:{" "}
                {String(
                  figures.kappa !== "not_computed" &&
                    figures.kappa >= Number(threshold),
                )}
                . The engine accepts or refuses the record.
              </p>
              <details>
                <summary>Every scored item and Result id</summary>
                <Raw value={plan.scores} />
              </details>
              <InputField
                label="Threshold after seeing results"
                value={threshold}
                onChange={setThreshold}
              />
              {(plan.threshold_changed_after_results ||
                Number(threshold) !== plan.threshold) && (
                <p className="notice">
                  threshold changed after results were seen
                </p>
              )}
              <button
                disabled={busy || !validThreshold}
                onClick={() => void updateThreshold()}
              >
                Save threshold change to plan
              </button>
              <h2>5. Record</h2>
              <InputField
                label="Arbitrations (one reason/reference per line)"
                value={arbitrations}
                onChange={setArbitrations}
                rows={3}
              />
              <button
                className="primary"
                disabled={busy || !validThreshold || figures.raw === null}
                onClick={() => void record()}
              >
                Record Admission
              </button>
            </section>
          )}
        </>
      )}
      <section aria-label="Admission records">
        <h2>Accepted Admission records — acceptance order</h2>
        <p>
          A newer accepted admitted: false record withdraws earlier admission of
          that exact configuration.
        </p>
        {[...new Set(records.map((r) => r.oracle))].map((id) => {
          const rows = records.filter((r) => r.oracle === id);
          return (
            <section key={id}>
              <details>
                <summary>Exact Oracle</summary>
                <pre className="json">{id}</pre>
              </details>
              {rows.map((row, index) => (
                <article className="admission-record" key={row.id}>
                  <p>
                    {row.id} · admitted: {String(row.admitted)}{" "}
                    {index === rows.length - 1 && (
                      <strong>decides current status</strong>
                    )}
                  </p>
                  <details>
                    <summary>Show engine record</summary>
                    <Raw value={row} />
                  </details>
                </article>
              ))}
            </section>
          );
        })}
        {!records.length && <p>No Admission records.</p>}
      </section>
    </div>
  );
}
