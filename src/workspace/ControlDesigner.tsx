import { useEffect, useMemo, useState } from "react";
import { parse, parseAllDocuments } from "yaml";
import { SelectField, InputField, incomplete } from "./OracleFields";
import { secretKeys, yamlText, type Data } from "./model";
import { request, collection, executionPath } from "../runs/api";
export function ControlDesigner({
  content,
  onChange,
  onError,
}: {
  content: string;
  onChange: (s: string) => void;
  onError: (s: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const doc = parseAllDocuments(content)[0],
        root = doc.toJS();
      return typeof root?.project === "object"
        ? { doc, root: root.project }
        : undefined;
    } catch {
      return undefined;
    }
  }, [content]);
  const [suite, setSuite] = useState(""),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [kind, setKind] = useState(""),
    [defect, setDefect] = useState(""),
    [planted, setPlanted] = useState(""),
    [confirmed, setConfirmed] = useState(""),
    [binding, setBinding] = useState(""),
    [evidence, setEvidence] = useState(""),
    [source, setSource] = useState(""),
    [loadedSource, setLoadedSource] = useState(""),
    [prompt, setPrompt] = useState(""),
    [variables, setVariables] = useState(""),
    [contract, setContract] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [policy, setPolicy] = useState(""),
    [original, setOriginal] = useState<Data>({});
  const owner = parsed?.root,
    suites = owner?.suites ?? [],
    active = suites.find((s: Data) => s.name === suite);
  function load(value: string) {
    setSelected(value);
    const s = active?.scenarios.find((s: Data) => s.name === value) ?? {};
    setOriginal(s);
    setName(s.name ?? "");
    setKind(s.seeded_control?.kind ?? "");
    setDefect(s.seeded_control?.defect_class ?? "");
    setPlanted(
      s.seeded_control?.planted_defect === undefined
        ? ""
        : yamlText(s.seeded_control.planted_defect),
    );
    setConfirmed(s.seeded_control?.confirmed_by ?? "");
    setBinding(s.evidence ? "fixed" : s.prompt ? "live" : "");
    setEvidence(s.evidence ? yamlText(s.evidence) : "");
    setSource(s.evidence?.source_execution ?? "");
    setPrompt(s.prompt?.template ?? "");
    setVariables(s.variables ? yamlText(s.variables) : "");
    setContract(s.contract ? yamlText(s.contract) : "");
    setConfirmation(
      s.seeded_control?.confirmation
        ? yamlText(s.seeded_control.confirmation)
        : "",
    );
    setPolicy(active?.execution?.on_seeded_control_miss ?? "");
  }
  useEffect(() => {
    const missing = [];
    if (!parsed) missing.push("Project definition YAML");
    if (!suite) missing.push("Suite");
    if (!name) missing.push("Scenario name");
    if (!kind) missing.push("kind");
    if (!defect) missing.push("defect_class");
    if (kind === "defect" && !planted.trim()) missing.push("planted_defect");
    if (!confirmed) missing.push("confirmed_by");
    if (!binding) missing.push("Evidence binding");
    if (!contract.trim()) missing.push("Contract");
    if (confirmed === "validator" && !confirmation.trim())
      missing.push("confirmation Constraint");
    if (binding === "fixed" && !evidence.trim()) missing.push("fixed Evidence");
    if (
      binding === "source" &&
      (!source || !evidence.trim() || loadedSource !== source)
    )
      missing.push("loaded source Execution Evidence");
    if (binding === "live" && !prompt.trim()) missing.push("prompt");
    if (missing.length) {
      onError(incomplete(missing));
      return;
    }
    if (
      [
        contract,
        ...(kind === "defect" ? [planted] : []),
        ...(binding === "live" ? [variables] : [evidence]),
        ...(confirmed === "validator" ? [confirmation] : []),
      ].some(secretKeys)
    ) {
      onError("Sensitive key detected. Use secret_ref.");
      return;
    }
    try {
      const docs = parseAllDocuments(content),
        root = docs[0].toJS().project,
        index = root.suites.findIndex((s: Data) => s.name === suite),
        s = root.suites[index],
        scenario: Data = { ...original, name, contract: parse(contract) },
        control = {
          ...original.seeded_control,
          kind,
          defect_class: defect,
          confirmed_by: confirmed,
        };
      delete control.planted_defect;
      delete control.confirmation;
      if (kind === "defect") control.planted_defect = parse(planted);
      else
        for (const key of [
          "difficulty_prior",
          "prior_basis",
          "prior_source",
          "reference_oracles",
        ])
          delete control[key];
      if (confirmed === "validator") control.confirmation = parse(confirmation);
      scenario.seeded_control = control;
      delete scenario.prompt;
      delete scenario.variables;
      delete scenario.dataset;
      delete scenario.evidence;
      if (binding === "live") {
        scenario.prompt = { template: prompt };
        if (variables.trim()) scenario.variables = parse(variables);
      } else {
        scenario.evidence = parse(evidence);
        if (binding === "source") scenario.evidence.source_execution = source;
      }
      const n = s.scenarios.findIndex((s: Data) => s.name === selected);
      if (s.scenarios.some((s: Data, i: number) => s.name === name && i !== n))
        throw new Error("Scenario name already exists");
      if (n < 0) s.scenarios.push(scenario);
      else s.scenarios[n] = scenario;
      if (policy)
        s.execution = { ...s.execution, on_seeded_control_miss: policy };
      else if (s.execution) {
        delete s.execution.on_seeded_control_miss;
        if (!Object.keys(s.execution).length) delete s.execution;
      }
      docs[0].set("project", root);
      onError("");
      onChange(
        docs.map((d) => d.toString().replace(/^---\s*\n/, "")).join("\n---\n"),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Invalid control form");
    }
  }, [
    content,
    suite,
    selected,
    name,
    kind,
    defect,
    planted,
    confirmed,
    binding,
    evidence,
    source,
    loadedSource,
    prompt,
    variables,
    contract,
    confirmation,
    policy,
    original,
  ]);
  async function fromExecution() {
    try {
      const path = executionPath(owner.name, source);
      const [conversation, artifacts] = await Promise.all([
        request(path + "/conversation"),
        collection<Data>(path + "/artifacts"),
      ]);
      const grouped: Data = {};
      for (const a of artifacts) {
        if (Object.hasOwn(grouped, a.name))
          throw new Error(
            "Repeated Artifact names require manual fixed-Evidence review; no source history projected away.",
          );
        grouped[a.name] = a.data;
      }
      setEvidence(
        yamlText({
          conversation,
          artifacts: grouped,
          source_execution: source,
        }),
      );
      setLoadedSource(source);
    } catch (err) {
      onError(String(err));
    }
  }
  return (
    <section className="designer-form" aria-label="Control Scenario form">
      <p>
        Forms propose YAML through the shared Review & Apply path. Controls
        never enter quality aggregates.
      </p>
      <SelectField
        label="Control Suite"
        value={suite}
        choices={suites.map((s: Data) => s.name)}
        onChange={(s) => {
          setSuite(s);
          setSelected("");
        }}
      />
      <SelectField
        label="Existing control Scenario"
        value={selected}
        omission="New control Scenario"
        choices={(active?.scenarios ?? [])
          .filter((s: Data) => s.seeded_control)
          .map((s: Data) => s.name)}
        onChange={load}
      />
      <InputField
        label="Control Scenario name"
        value={name}
        onChange={setName}
      />
      <SelectField
        label="Control kind"
        value={kind}
        choices={["defect", "clean"]}
        onChange={setKind}
      />
      <InputField label="Defect class" value={defect} onChange={setDefect} />
      {kind === "defect" && (
        <InputField
          label="Planted defect (YAML)"
          value={planted}
          onChange={setPlanted}
          rows={2}
        />
      )}
      <SelectField
        label="Confirmed by"
        value={confirmed}
        choices={["construction", "validator", "human_reviewer"]}
        onChange={setConfirmed}
      />
      {confirmed === "validator" && (
        <InputField
          label="Confirmation Constraint (YAML)"
          value={confirmation}
          onChange={setConfirmation}
          rows={4}
        />
      )}
      <SelectField
        label="Control Evidence binding"
        value={binding}
        choices={[
          ["fixed", "Fixed Evidence"],
          ["source", "Copy source_execution Evidence"],
          ["live", "Subject prompt / Variables"],
        ]}
        onChange={setBinding}
      />
      <p>
        The pin permits fixed Evidence only with construction. Other
        confirmation methods use captured subject Evidence; unsupported
        combinations are refused by the engine. source_execution is provenance
        on a required fixed Conversation, not an instruction to re-run the
        subject.
      </p>
      {binding === "source" && (
        <>
          <InputField
            label="Source Execution id"
            value={source}
            onChange={setSource}
          />
          <button onClick={() => void fromExecution()}>
            Load source Evidence
          </button>
          <p>
            Copying projects all recorded Artifact names into a FixedEvidence
            map; repeated names require manual YAML review so no turn history is
            silently lost.
          </p>
        </>
      )}
      {binding === "live" ? (
        <>
          <InputField
            label="Control Prompt"
            value={prompt}
            onChange={setPrompt}
            rows={2}
          />
          <InputField
            label="Control Variables (YAML)"
            value={variables}
            onChange={setVariables}
            rows={3}
          />
        </>
      ) : (
        <InputField
          label="Fixed control Evidence (YAML)"
          value={evidence}
          onChange={setEvidence}
          rows={5}
        />
      )}
      <InputField
        label="Control Contract (YAML)"
        value={contract}
        onChange={setContract}
        rows={5}
      />
      <SelectField
        label="Suite on_seeded_control_miss"
        value={policy}
        choices={["skip_class", "halt_run"]}
        omission="Omit — inherit Project; engine global default skip_class"
        onChange={setPolicy}
      />
    </section>
  );
}
