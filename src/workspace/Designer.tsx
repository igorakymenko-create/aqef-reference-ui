import { useEffect, useMemo, useState } from "react";
import { parseAllDocuments, parse } from "yaml";
import { yamlText, secretKeys, type Data } from "./model";

type Clause = {
  kind: "constraint" | "expectation";
  original: Data;
  id: string;
  dimension: string;
  validator: string;
  target: string;
  expected: string;
  criteria: string;
  model: string;
  confidenceSource: string;
  threshold: string;
};
const blank = (kind: Clause["kind"]): Clause => ({
  kind,
  original: {},
  id: "",
  dimension: "",
  validator: "",
  target: "",
  expected: "",
  criteria: "",
  model: "",
  confidenceSource: "",
  threshold: "",
});
const dimensions = ["functional", "semantic", "operational", "safety"];
function formYaml(text: string, field: string) {
  try {
    return parse(text);
  } catch {
    throw new Error(
      `Invalid YAML syntax in ${field}; no source values echoed.`,
    );
  }
}
function Choice({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose explicitly…</option>
        {choices.map((choice) => (
          <option key={choice}>{choice}</option>
        ))}
      </select>
    </label>
  );
}
export function Designer({
  content,
  onChange,
  onError,
}: {
  content: string;
  onChange: (text: string) => void;
  onError: (message: string) => void;
}) {
  const source = useMemo(() => {
    try {
      const documents = parseAllDocuments(content, { uniqueKeys: true });
      const index = documents.findIndex(
        (d) => d.get("project") && typeof d.toJS()?.project === "object",
      );
      if (index < 0 || documents.some((d) => d.errors.length)) return undefined;
      return {
        documents,
        index,
        project: documents[index].toJS().project as Data,
      };
    } catch {
      return undefined;
    }
  }, [content]);
  const [suiteName, setSuiteName] = useState(""),
    [selected, setSelected] = useState("");
  const [name, setName] = useState(""),
    [prompt, setPrompt] = useState(""),
    [binding, setBinding] = useState("");
  const [variables, setVariables] = useState(""),
    [dataset, setDataset] = useState("");
  const [contractMode, setContractMode] = useState(""),
    [reference, setReference] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]),
    [original, setOriginal] = useState<Data>({});
  const suite = source?.project.suites?.find((s: Data) => s.name === suiteName);
  const sensitive =
    secretKeys(variables) ||
    clauses.some((clause) => secretKeys(clause.expected));
  function loadScenario(scenarioName: string) {
    setSelected(scenarioName);
    const scenario =
      suite?.scenarios?.find((s: Data) => s.name === scenarioName) ?? {};
    setOriginal(scenario);
    setName(scenario.name ?? "");
    setPrompt(scenario.prompt?.template ?? "");
    setBinding(
      scenario.dataset
        ? "dataset"
        : scenario.variables
          ? "variables"
          : scenarioName
            ? "none"
            : "",
    );
    setVariables(scenario.variables ? yamlText(scenario.variables) : "");
    setDataset(scenario.dataset ?? "");
    setContractMode(
      typeof scenario.contract === "string"
        ? "reference"
        : scenario.contract
          ? "inline"
          : scenarioName
            ? "inherit"
            : "",
    );
    setReference(
      typeof scenario.contract === "string" ? scenario.contract : "",
    );
    const contract =
      typeof scenario.contract === "object" ? scenario.contract : {};
    setClauses([
      ...(contract.constraints ?? []).map((c: Data) => ({
        ...blank("constraint"),
        original: c,
        id: c.id ?? "",
        dimension: c.dimension ?? "",
        validator: c.validator ?? "",
        target: c.target ?? "",
        expected: yamlText(c.expected),
      })),
      ...(contract.expectations ?? []).map((c: Data) => ({
        ...blank("expectation"),
        original: c,
        id: c.id ?? "",
        dimension: c.dimension ?? "",
        criteria: c.criteria ?? "",
        model: c.judge?.model ?? "",
        confidenceSource: c.judge?.confidence_source ?? "",
        threshold:
          c.confidence_threshold === undefined
            ? ""
            : String(c.confidence_threshold),
      })),
    ]);
  }
  useEffect(() => {
    if (sensitive) {
      onError(
        "Sensitive key detected. Use secret_ref; form content is hidden.",
      );
      return;
    }
    if (!source || !suite) {
      onError("Choose a Project document and a Suite.");
      return;
    }
    if (!name && !prompt && !binding && !contractMode) {
      onError("Fill the Scenario fields; no authoring defaults are inserted.");
      return;
    }
    try {
      if (original.seeded_control || original.evidence)
        throw new Error(
          "Fixed Evidence and Seeded Controls are edited in YAML in UI-2.",
        );
      if (!binding || !contractMode)
        throw new Error(
          "Choose the Variables/Dataset binding and Contract source explicitly.",
        );
      const scenario = structuredClone(original);
      scenario.name = name;
      scenario.prompt = { ...scenario.prompt, template: prompt };
      delete scenario.variables;
      delete scenario.dataset;
      if (binding === "variables") {
        const value = formYaml(variables, "Variables");
        if (!value || typeof value !== "object" || Array.isArray(value))
          throw new Error(
            "Variables must be a YAML mapping; enter {} for an explicitly empty mapping.",
          );
        scenario.variables = value;
      }
      if (binding === "dataset") scenario.dataset = dataset;
      delete scenario.contract;
      if (contractMode === "reference") scenario.contract = reference;
      if (contractMode === "inline") {
        const contract =
          typeof original.contract === "object"
            ? structuredClone(original.contract)
            : {};
        contract.constraints = [];
        contract.expectations = [];
        for (const clause of clauses) {
          const value = structuredClone(clause.original);
          delete value.id;
          delete value.dimension;
          if (clause.id) value.id = clause.id;
          if (clause.dimension) value.dimension = clause.dimension;
          if (clause.kind === "constraint") {
            value.validator = clause.validator;
            value.target = clause.target;
            if (!clause.expected.trim())
              throw new Error("Supply the Constraint expected value as YAML.");
            value.expected = formYaml(clause.expected, "Constraint expected");
            contract.constraints.push(value);
          } else {
            if (value.multi_judge || value.human_reviewer)
              throw new Error(
                "Existing Multi Judge or Human Reviewer clauses are preserved through the YAML editor; this form edits Single Judge clauses.",
              );
            value.criteria = clause.criteria;
            value.judge = {
              model: clause.model,
              confidence_source: clause.confidenceSource,
            };
            delete value.confidence_threshold;
            if (clause.threshold !== "") {
              if (!Number.isFinite(Number(clause.threshold)))
                throw new Error(
                  "Confidence threshold must be a finite number.",
                );
              value.confidence_threshold = Number(clause.threshold);
            }
            contract.expectations.push(value);
          }
        }
        scenario.contract = contract;
      }
      const documents = source.documents.map((d) => d.clone());
      const suiteIndex = source.project.suites.findIndex(
        (s: Data) => s.name === suiteName,
      );
      const scenarios = [...suite.scenarios];
      const index = selected
        ? scenarios.findIndex((s: Data) => s.name === selected)
        : -1;
      if (index >= 0) scenarios[index] = scenario;
      else scenarios.push(scenario);
      documents[source.index].setIn(
        ["project", "suites", suiteIndex, "scenarios"],
        scenarios,
      );
      const text = documents
        .map((d) => d.toString({ lineWidth: 100 }).replace(/^---\s*\n/, ""))
        .join("\n---\n");
      onError("");
      onChange(text);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Invalid form YAML");
    }
  }, [
    sensitive,
    source,
    suiteName,
    selected,
    name,
    prompt,
    binding,
    variables,
    dataset,
    contractMode,
    reference,
    clauses,
    original,
  ]);
  const update = (index: number, key: keyof Clause, value: string) =>
    setClauses((old) =>
      old.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  if (!source)
    return (
      <div className="notice">
        Open a syntactically valid Project YAML document to use the Visual Test
        Designer. Split resources can be authored in the YAML editor.
      </div>
    );
  return (
    <section className="designer-form" aria-label="Scenario form">
      <div className="form-grid">
        <Choice
          label="Suite"
          value={suiteName}
          choices={source.project.suites?.map((s: Data) => s.name) ?? []}
          onChange={(value) => {
            setSuiteName(value);
            setSelected("");
            setName("");
            setPrompt("");
            setBinding("");
            setContractMode("");
            setOriginal({});
            setClauses([]);
          }}
        />
        <label>
          Existing Scenario
          <select
            aria-label="Existing Scenario"
            value={selected}
            onChange={(e) => loadScenario(e.target.value)}
          >
            <option value="">New Scenario</option>
            {suite?.scenarios?.map((s: Data) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Scenario name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Prompt template
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </label>
      <Choice
        label="Variables / Dataset binding"
        value={binding}
        choices={["none", "variables", "dataset"]}
        onChange={setBinding}
      />
      {binding === "variables" && (
        <label>
          Variables (YAML mapping)
          <textarea
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            rows={4}
          />
        </label>
      )}
      {binding === "dataset" && (
        <label>
          Dataset reference (name@version)
          <input value={dataset} onChange={(e) => setDataset(e.target.value)} />
        </label>
      )}
      <Choice
        label="Contract source"
        value={contractMode}
        choices={["inherit", "reference", "inline"]}
        onChange={setContractMode}
      />
      {contractMode === "inherit" && (
        <p>
          Uses Project and Suite Contracts; the engine resolves the effective
          Contract.
        </p>
      )}
      {contractMode === "reference" && (
        <label>
          Reusable Contract name
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
      )}
      {contractMode === "inline" && (
        <>
          <h3>Contract clauses</h3>
          {clauses.map((clause, index) => (
            <fieldset key={index}>
              <legend>
                {clause.kind === "constraint" ? "Constraint" : "Expectation"} ·
                position {index + 1}
              </legend>
              <div className="form-grid">
                <label>
                  Clause id
                  <input
                    aria-label={`Clause ${index + 1} id`}
                    value={clause.id}
                    onChange={(e) => update(index, "id", e.target.value)}
                  />
                </label>
                <Choice
                  label={`Clause ${index + 1} dimension`}
                  value={clause.dimension}
                  choices={dimensions}
                  onChange={(value) => update(index, "dimension", value)}
                />
              </div>
              {clause.kind === "constraint" ? (
                <>
                  <Choice
                    label={`Clause ${index + 1} Validator`}
                    value={clause.validator}
                    choices={[
                      "schema",
                      "structural",
                      "latency",
                      "cost",
                      "forbidden-content",
                      "tool-call",
                      "boundary",
                    ]}
                    onChange={(value) => update(index, "validator", value)}
                  />
                  <label>
                    Target
                    <input
                      aria-label={`Clause ${index + 1} target`}
                      value={clause.target}
                      onChange={(e) => update(index, "target", e.target.value)}
                    />
                  </label>
                  <label>
                    Expected (YAML)
                    <textarea
                      aria-label={`Clause ${index + 1} expected`}
                      value={clause.expected}
                      onChange={(e) =>
                        update(index, "expected", e.target.value)
                      }
                    />
                  </label>
                  {["boundary", "tool-call"].includes(clause.validator) && (
                    <span className="badge">
                      At Risk in 1.0-CR1 · acting tools are outside the pinned
                      engine's scope
                    </span>
                  )}
                </>
              ) : (
                <>
                  <label>
                    Criteria
                    <textarea
                      aria-label={`Clause ${index + 1} criteria`}
                      value={clause.criteria}
                      onChange={(e) =>
                        update(index, "criteria", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Judge model
                    <input
                      aria-label={`Clause ${index + 1} Judge model`}
                      value={clause.model}
                      onChange={(e) => update(index, "model", e.target.value)}
                    />
                  </label>
                  <Choice
                    label={`Clause ${index + 1} Confidence source`}
                    value={clause.confidenceSource}
                    choices={["self_rating", "token_probability", "agreement"]}
                    onChange={(value) =>
                      update(index, "confidenceSource", value)
                    }
                  />
                  <label>
                    Confidence threshold
                    <input
                      aria-label={`Clause ${index + 1} Confidence threshold`}
                      inputMode="decimal"
                      value={clause.threshold}
                      onChange={(e) =>
                        update(index, "threshold", e.target.value)
                      }
                    />
                  </label>
                </>
              )}
              <button
                onClick={() =>
                  setClauses((old) => old.filter((_, i) => i !== index))
                }
              >
                Remove clause {index + 1}
              </button>
            </fieldset>
          ))}
          <div className="button-row">
            <button
              onClick={() => setClauses((old) => [...old, blank("constraint")])}
            >
              Add Constraint
            </button>
            <button
              onClick={() =>
                setClauses((old) => [...old, blank("expectation")])
              }
            >
              Add Expectation
            </button>
          </div>
        </>
      )}
      <p className="footnote">
        This form only proposes YAML. Review &amp; Apply is the same path used
        by the YAML editor. Unselected author fields stay empty; no hidden
        defaults are saved.
      </p>
    </section>
  );
}
