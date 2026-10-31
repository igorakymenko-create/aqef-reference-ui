import { useEffect, useMemo, useState } from "react";
import { parse } from "yaml";
import {
  appendValidator,
  contractTargets,
  editContract,
} from "./contractEditing";
import { BUILTINS, PURE_OPERATIONS, VALIDATOR_RULE } from "./oracleRules";
import { secretKeys, yamlText, type Data } from "./model";
import {
  ContractField,
  DIMENSIONS,
  InputField,
  SelectField,
  incomplete,
  type OracleFormProps,
} from "./OracleFields";

const PARAMETERS: Record<string, string> = {
  schema:
    'target: response or a documented Evidence path. expected: a JSON Schema object/Boolean, or the string "json". A Response is text; JSON is not implicitly decoded.',
  structural:
    "target: conversation, text or a sequence. expected: an ordered string list, or {required_steps: [...]}.",
  "forbidden-content":
    'expected: {patterns: ["literal", {regex: "Python pattern"}]}. A match fails the check.',
  latency:
    "target: duration_ms or recorded latency Artifacts. expected: numeric milliseconds or a duration string, for example 500ms.",
  cost: "target: artifacts.usage or a numeric metric. expected: a numeric maximum for total_tokens, or {metric: cost, max: 0.05}.",
  "tool-call":
    "At Risk in 1.0-CR1. Acting tools are outside this pinned engine capability; this Validator is not implemented by it.",
  boundary:
    "At Risk in 1.0-CR1. Acting tools are outside this pinned engine capability; this Validator is not implemented by it.",
};
export function ValidatorDesigner(
  props: OracleFormProps & { onHandoff: (draft: Data) => void },
) {
  const { content, roots, providers, onChange, onError } = props;
  const targets = useMemo(() => contractTargets(content), [content]);
  const [kind, setKind] = useState(""),
    [attachment, setAttachment] = useState(""),
    [clauseIndex, setClauseIndex] = useState("new");
  const [id, setId] = useState(""),
    [dimension, setDimension] = useState(""),
    [identifier, setIdentifier] = useState(""),
    [target, setTarget] = useState(""),
    [expected, setExpected] = useState(""),
    [veto, setVeto] = useState(""),
    [composition, setComposition] = useState("");
  const [name, setName] = useState(""),
    [version, setVersion] = useState(""),
    [operation, setOperation] = useState(""),
    [ruleExpected, setRuleExpected] = useState(""),
    [minimum, setMinimum] = useState(""),
    [maximum, setMaximum] = useState("");
  const [callsModel, setCallsModel] = useState(""),
    [binding, setBinding] = useState(""),
    [owner, setOwner] = useState(""),
    [description, setDescription] = useState(""),
    [modelIdentifier, setModelIdentifier] = useState("");
  const location = attachment === "" ? undefined : targets[Number(attachment)];
  const clauses = location?.contract.constraints ?? [];
  const sensitive = (
    kind === "custom"
      ? [ruleExpected, ...(binding === "bind" ? [expected] : [])]
      : [expected]
  ).some(secretKeys);
  const mapped = (
    kind === "custom"
      ? [modelIdentifier, name, `${name}@${version}`]
      : [identifier]
  ).find((value) => value && Object.hasOwn(providers, value));
  const refusal =
    (callsModel === "yes" && kind === "custom") || Boolean(mapped);
  function load(index: string, where = location) {
    setClauseIndex(index);
    const clause =
      index === "new"
        ? {}
        : (where?.contract.constraints?.[Number(index)] ?? {});
    setId(clause.id ?? "");
    setDimension(clause.dimension ?? "");
    setIdentifier(clause.validator ?? "");
    setTarget(clause.target ?? "");
    setExpected(
      Object.hasOwn(clause, "expected") ? yamlText(clause.expected) : "",
    );
    setVeto(clause.veto === undefined ? "" : String(clause.veto));
    setComposition(where?.contract.policies?.validator_composition ?? "");
  }
  useEffect(() => {
    if (sensitive) {
      onError(
        "Sensitive key detected. Use secret_ref; form content is hidden.",
      );
      return;
    }
    if (refusal) {
      onError(
        VALIDATOR_RULE +
          (mapped ? " The identifier is a mapped model provider." : ""),
      );
      return;
    }
    const missing: string[] = [];
    if (!kind) missing.push("Validator kind");
    if (kind === "custom") {
      if (!callsModel)
        missing.push(
          "whether the check calls a model or non-deterministic service",
        );
      if (!binding) missing.push("registration mode");
      if (!owner) missing.push("Project");
      if (!name) missing.push("Custom Validator name");
      if (!version) missing.push("Custom Validator version");
      if (!operation) missing.push("deterministic operation");
      if (operation === "range") {
        if (!minimum.trim()) missing.push("rule minimum");
        if (!maximum.trim()) missing.push("rule maximum");
      } else if (!ruleExpected.trim()) missing.push("rule expected value");
    }
    const bind = kind !== "custom" || binding === "bind";
    if (bind) {
      if (!location) missing.push("Contract attachment");
      if (!target.trim()) missing.push("target");
      if (!expected.trim()) missing.push("expected");
      if (kind !== "custom" && !identifier.trim())
        missing.push("Validator identifier");
      if ((kind === "custom" || kind === "registered") && !dimension)
        missing.push("Custom Validator dimension");
    }
    if (missing.length) {
      onError(incomplete(missing));
      return;
    }
    try {
      let proposed = content;
      if (bind && location) {
        if (kind === "custom" && location.project !== owner)
          throw new Error(
            "The registration Project must match the selected Contract Project.",
          );
        const contract = structuredClone(location.contract),
          all = [...(contract.constraints ?? [])];
        const original =
          clauseIndex === "new"
            ? {}
            : structuredClone(all[Number(clauseIndex)] ?? {});
        delete original.id;
        delete original.dimension;
        delete original.veto;
        if (id) original.id = id;
        if (dimension) original.dimension = dimension;
        if (veto !== "") original.veto = veto === "true";
        original.validator =
          kind === "custom" ? `${name}@${version}` : identifier;
        original.target = target;
        try {
          original.expected = parse(expected);
        } catch {
          throw new Error(
            "Invalid YAML syntax in expected; no source values echoed.",
          );
        }
        if (kind === "registered" || kind === "custom")
          if (
            original.expected !== null &&
            (typeof original.expected !== "object" ||
              Array.isArray(original.expected) ||
              Object.keys(original.expected).length)
          )
            throw new Error(
              "The pinned Custom Validator binding expects null or {}; its registered rule supplies the expectation.",
            );
        if (clauseIndex === "new") all.push(original);
        else all[Number(clauseIndex)] = original;
        contract.constraints = all;
        if (composition)
          contract.policies = {
            ...contract.policies,
            validator_composition: composition,
          };
        else if (contract.policies) {
          delete contract.policies.validator_composition;
          if (!Object.keys(contract.policies).length) delete contract.policies;
        }
        proposed = editContract(content, location, contract);
      }
      if (kind === "custom") {
        let rule: Data;
        if (operation === "range") {
          if (
            !Number.isFinite(Number(minimum)) ||
            !Number.isFinite(Number(maximum))
          )
            throw new Error("Range bounds must be finite numbers.");
          rule = {
            operation,
            minimum: Number(minimum),
            maximum: Number(maximum),
          };
        } else {
          let value;
          try {
            value = parse(ruleExpected);
          } catch {
            throw new Error(
              "Invalid YAML syntax in rule expected; no source values echoed.",
            );
          }
          rule = { operation, expected: value };
        }
        proposed = appendValidator(proposed, owner, { name, version, rule });
      }
      onError("");
      onChange(proposed);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Invalid Validator form",
      );
    }
  }, [
    content,
    kind,
    attachment,
    clauseIndex,
    id,
    dimension,
    identifier,
    target,
    expected,
    veto,
    composition,
    name,
    version,
    operation,
    ruleExpected,
    minimum,
    maximum,
    callsModel,
    binding,
    owner,
    sensitive,
    refusal,
  ]);
  return (
    <section className="designer-form" aria-label="Validator form">
      <p>
        Volume XV: “MUST be deterministic and MUST NOT carry a Confidence
        value”. No model, network call, clock or random source decides a
        Validator verdict.
      </p>
      <SelectField
        label="Validator kind"
        value={kind}
        choices={["built-in", "registered", "custom"]}
        onChange={(value) => {
          setKind(value);
          load("new");
        }}
      />
      {kind === "custom" && (
        <>
          <SelectField
            label="Project"
            value={owner}
            choices={[...roots.keys()]}
            onChange={setOwner}
          />
          <InputField
            label="Custom Validator name"
            value={name}
            onChange={setName}
          />
          <InputField
            label="Custom Validator version"
            value={version}
            onChange={setVersion}
          />
          <InputField
            label="Check description / proposed Judge criteria"
            value={description}
            onChange={setDescription}
            rows={2}
          />
          <InputField
            label="Implementation/model identifier (optional)"
            value={modelIdentifier}
            onChange={setModelIdentifier}
          />
          <SelectField
            label="Does this check call a model, or any non-deterministic service, to decide pass or fail?"
            value={callsModel}
            choices={["no", "yes"]}
            onChange={setCallsModel}
          />
          <SelectField
            label="Registration mode"
            value={binding}
            choices={[
              ["only", "Register only"],
              ["bind", "Register and bind a Constraint"],
            ]}
            onChange={setBinding}
          />
          <SelectField
            label="Deterministic operation"
            value={operation}
            choices={PURE_OPERATIONS}
            onChange={setOperation}
          />
          {operation === "range" ? (
            <div className="form-grid">
              <InputField
                label="Rule minimum"
                value={minimum}
                onChange={setMinimum}
              />
              <InputField
                label="Rule maximum"
                value={maximum}
                onChange={setMaximum}
              />
            </div>
          ) : (
            <InputField
              label="Rule expected (YAML)"
              value={ruleExpected}
              onChange={setRuleExpected}
              rows={3}
            />
          )}
        </>
      )}
      {(kind !== "custom" || binding === "bind") && (
        <>
          <ContractField
            targets={targets}
            value={attachment}
            onChange={(value) => {
              setAttachment(value);
              load("new", targets[Number(value)]);
            }}
          />
          <SelectField
            label="Existing Constraint"
            value={clauseIndex === "new" ? "" : clauseIndex}
            omission="New Constraint"
            choices={clauses.map((c: Data, index: number) => [
              String(index),
              c.id ?? `unnamed clause ${index + 1}`,
            ])}
            onChange={(value) => load(value || "new")}
          />
          {kind === "built-in" ? (
            <SelectField
              label="Validator identifier"
              value={identifier}
              choices={[...BUILTINS, "tool-call", "boundary"]}
              onChange={setIdentifier}
            />
          ) : kind === "registered" ? (
            <InputField
              label="Validator identifier (name@version)"
              value={identifier}
              onChange={setIdentifier}
            />
          ) : null}
          {PARAMETERS[identifier] && (
            <p
              className={
                ["boundary", "tool-call"].includes(identifier)
                  ? "notice"
                  : "footnote"
              }
            >
              {PARAMETERS[identifier]}
            </p>
          )}
          <InputField
            label="Constraint id (optional)"
            value={id}
            onChange={setId}
          />
          <SelectField
            label="Constraint dimension"
            value={dimension}
            choices={DIMENSIONS}
            omission="Omit; built-in dimension follows its documented type"
            onChange={setDimension}
          />
          <InputField label="Target" value={target} onChange={setTarget} />
          <InputField
            label="Expected (YAML)"
            value={expected}
            onChange={setExpected}
            rows={3}
          />
          <SelectField
            label="Veto"
            value={veto}
            choices={["true", "false"]}
            omission="Omit — documented default false"
            onChange={setVeto}
          />
          <SelectField
            label="Contract validator_composition"
            value={composition}
            choices={["AND", "OR", "hard-veto"]}
            omission="Omit policy contribution; engine resolves composition"
            onChange={setComposition}
          />
          <p>
            Composition is a Contract policy, not a new Constraint property.
            Volume VII resolves the strictest contributed mode; this form does
            not compute it.
          </p>
        </>
      )}
      {refusal && (
        <div role="alert" className="error">
          <p>
            {VALIDATOR_RULE}{" "}
            {mapped && "The identifier is a mapped model provider."}
          </p>
          <button
            onClick={() =>
              props.onHandoff({
                kind,
                name,
                version,
                target,
                criteria: description,
                model: modelIdentifier || mapped || "",
                identifier,
                operation,
                ruleExpected,
                minimum,
                maximum,
                id,
                dimension,
                expected,
                veto,
                composition,
                callsModel,
              })
            }
          >
            Open Judge Configuration with entered draft
          </button>
        </div>
      )}
      <details>
        <summary>Built-in parameters provided by this engine</summary>
        {Object.entries(PARAMETERS).map(([name, hint]) => (
          <p key={name}>
            <strong>{name}</strong> — {hint}
          </p>
        ))}
      </details>
    </section>
  );
}
