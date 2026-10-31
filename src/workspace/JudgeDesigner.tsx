import { useEffect, useMemo, useState } from "react";
import { contractTargets, editContract } from "./contractEditing";
import { canonical, type Data } from "./model";
import { all } from "./api";
import {
  INDEPENDENCE_RULE,
  NEW_JUDGE_WARNING,
  PURPOSE_RULE,
  judgeIdentity,
  judgeMembers,
  modelFamily,
} from "./oracleRules";
import {
  ContractField,
  DIMENSIONS,
  InputField,
  SelectField,
  incomplete,
  type OracleFormProps,
} from "./OracleFields";
type Member = { model: string; confidence_source: string };
const empty = (): Member => ({ model: "", confidence_source: "" });
export function JudgeDesigner({
  content,
  roots,
  providers,
  onChange,
  onError,
  prefill,
}: OracleFormProps & { prefill?: Data }) {
  const targets = useMemo(() => contractTargets(content), [content]);
  const [attachment, setAttachment] = useState(""),
    [selected, setSelected] = useState("new");
  const [kind, setKind] = useState(""),
    [id, setId] = useState(""),
    [dimension, setDimension] = useState(""),
    [criteria, setCriteria] = useState(prefill?.criteria ?? ""),
    [threshold, setThreshold] = useState("");
  const [single, setSingle] = useState<Member>({
      ...empty(),
      model: prefill?.model ?? "",
    }),
    [purpose, setPurpose] = useState(""),
    [members, setMembers] = useState<Member[]>([empty(), empty()]),
    [samples, setSamples] = useState("");
  const [method, setMethod] = useState(""),
    [voting, setVoting] = useState(""),
    [fraction, setFraction] = useState(""),
    [disagreement, setDisagreement] = useState(""),
    [quorum, setQuorum] = useState(""),
    [agreement, setAgreement] = useState("");
  const [original, setOriginal] = useState<Data>({}),
    [records, setRecords] = useState<Data[]>([]),
    [admissionsReady, setAdmissionsReady] = useState(false),
    [admissionsError, setAdmissionsError] = useState("");
  const location = attachment === "" ? undefined : targets[Number(attachment)];
  const configurations =
    kind === "multi" && purpose === "independence" ? members : [single];
  const subjects = (roots.get(location?.project ?? "")?.environments ?? []).map(
    (e: Data) => e.model_version,
  );
  const sameSubject = configurations.some(
    (config) => config.model && subjects.includes(config.model),
  );
  const familyWarning = configurations.some(
    (config) =>
      config.model &&
      !subjects.includes(config.model) &&
      subjects.some(
        (subject: string) => modelFamily(subject) === modelFamily(config.model),
      ),
  );
  const initial = judgeMembers(original).map((config) =>
    judgeIdentity(config, original.criteria),
  );
  const changed =
    Boolean(original.criteria) &&
    configurations.some(
      (config) =>
        config.model &&
        config.confidence_source &&
        !initial.includes(judgeIdentity(config, criteria)),
    );
  function load(index: string, where = location) {
    setSelected(index);
    const clause =
      index === "new"
        ? {}
        : (where?.contract.expectations?.[Number(index)] ?? {});
    setOriginal(clause);
    setKind(clause.multi_judge ? "multi" : clause.judge ? "single" : "");
    setId(clause.id ?? "");
    setDimension(clause.dimension ?? "");
    setCriteria(clause.criteria ?? prefill?.criteria ?? "");
    setThreshold(
      clause.confidence_threshold === undefined
        ? ""
        : String(clause.confidence_threshold),
    );
    setSingle(
      clause.judge ??
        clause.multi_judge?.judge ?? {
          ...empty(),
          model: prefill?.model ?? "",
        },
    );
    setPurpose(clause.multi_judge?.purpose ?? "");
    setMembers(clause.multi_judge?.judges ?? [empty(), empty()]);
    setSamples(
      clause.multi_judge?.samples === undefined
        ? ""
        : String(clause.multi_judge.samples),
    );
    const consensus = clause.multi_judge?.consensus ?? {};
    setMethod(consensus.method ?? "");
    setVoting(
      typeof consensus.threshold === "number"
        ? "fraction"
        : (consensus.threshold ?? ""),
    );
    setFraction(
      typeof consensus.threshold === "number"
        ? String(consensus.threshold)
        : "",
    );
    setDisagreement(consensus.on_disagreement ?? "");
    setQuorum(
      consensus.min_qualified === undefined
        ? ""
        : String(consensus.min_qualified),
    );
    setAgreement(
      consensus.min_agreement === undefined
        ? ""
        : String(consensus.min_agreement),
    );
  }
  useEffect(() => {
    let active = true;
    setAdmissionsReady(false);
    setRecords([]);
    setAdmissionsError("");
    if (!location?.project) return;
    all(`/api/projects/${encodeURIComponent(location.project)}/admissions`)
      .then((data) => {
        if (active) {
          setRecords(data);
          setAdmissionsReady(true);
        }
      })
      .catch((error) => {
        if (active)
          setAdmissionsError(
            error instanceof Error ? error.message : String(error),
          );
      });
    return () => {
      active = false;
    };
  }, [location?.project]);
  useEffect(() => {
    const missing: string[] = [];
    if (!location) missing.push("Contract attachment");
    if (!kind) missing.push("Judge type");
    if (!criteria.trim()) missing.push("criteria");
    if (threshold === "") missing.push("Confidence threshold");
    if (kind === "multi" && !purpose)
      missing.push("explicit purpose (independence or stability)");
    if (kind === "multi" && !method) missing.push("Consensus method");
    if (kind === "multi" && purpose === "stability" && !samples)
      missing.push("sample count");
    configurations.forEach((config, index) => {
      if (!config.model.trim()) missing.push(`Judge ${index + 1} model`);
      if (!config.confidence_source)
        missing.push(`Judge ${index + 1} confidence_source`);
    });
    if (
      kind === "multi" &&
      method === "voting" &&
      voting === "fraction" &&
      !fraction
    )
      missing.push("numeric voting threshold");
    if (sameSubject) {
      onError(INDEPENDENCE_RULE);
      return;
    }
    if (kind === "multi" && !purpose) {
      onError(`${incomplete(missing)} ${PURPOSE_RULE}`);
      return;
    }
    if (missing.length) {
      onError(incomplete(missing));
      return;
    }
    try {
      if (
        !Number.isFinite(Number(threshold)) ||
        Number(threshold) < 0 ||
        Number(threshold) > 1
      )
        throw new Error("Confidence threshold must be a number in [0, 1].");
      if (!location) return;
      const clause = structuredClone(original);
      delete clause.judge;
      delete clause.multi_judge;
      delete clause.human_reviewer;
      delete clause.id;
      delete clause.dimension;
      if (id) clause.id = id;
      if (dimension) clause.dimension = dimension;
      clause.criteria = criteria;
      clause.confidence_threshold = Number(threshold);
      if (kind === "single") clause.judge = { ...original.judge, ...single };
      else {
        const panel: Data = { ...original.multi_judge, purpose };
        delete panel.judges;
        delete panel.judge;
        delete panel.samples;
        if (purpose === "independence") {
          if (
            members.length < 2 ||
            new Set(members.map((member) => judgeIdentity(member, criteria)))
              .size !== members.length
          )
            throw new Error(
              "Volume VI / A.7: independence requires at least two distinct Judge configurations.",
            );
          panel.judges = members;
        } else {
          if (!Number.isInteger(Number(samples)) || Number(samples) < 2)
            throw new Error(
              "A.7: stability requires an explicit integer sample count of at least two.",
            );
          panel.judge = single;
          panel.samples = Number(samples);
        }
        const consensus: Data = { ...original.multi_judge?.consensus, method };
        delete consensus.threshold;
        delete consensus.on_disagreement;
        delete consensus.min_qualified;
        delete consensus.min_agreement;
        if (method === "voting" && voting) {
          if (voting === "fraction") {
            if (
              !Number.isFinite(Number(fraction)) ||
              Number(fraction) <= 0.5 ||
              Number(fraction) > 1
            )
              throw new Error(
                "A.7: numeric voting threshold must be greater than 0.5 and at most 1.0.",
              );
            consensus.threshold = Number(fraction);
          } else consensus.threshold = voting;
        }
        if (disagreement) consensus.on_disagreement = disagreement;
        if (quorum !== "") {
          if (!Number.isInteger(Number(quorum)) || Number(quorum) < 1)
            throw new Error("A.7: min_qualified must be a positive integer.");
          consensus.min_qualified = Number(quorum);
        }
        if (method === "confidence_weighted_mean" && agreement !== "") {
          if (
            !Number.isFinite(Number(agreement)) ||
            Number(agreement) < 0 ||
            Number(agreement) > 1
          )
            throw new Error("A.7: min_agreement must be in [0, 1].");
          consensus.min_agreement = Number(agreement);
        }
        panel.consensus = consensus;
        clause.multi_judge = panel;
      }
      const contract = structuredClone(location.contract),
        clauses = [...(contract.expectations ?? [])];
      if (selected === "new") clauses.push(clause);
      else clauses[Number(selected)] = clause;
      contract.expectations = clauses;
      onError("");
      onChange(editContract(content, location, contract));
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Invalid Judge configuration",
      );
    }
  }, [
    content,
    attachment,
    selected,
    kind,
    id,
    dimension,
    criteria,
    threshold,
    single,
    purpose,
    members,
    samples,
    method,
    voting,
    fraction,
    disagreement,
    quorum,
    agreement,
    original,
    sameSubject,
  ]);
  function modelFields(
    config: Member,
    update: (value: Member) => void,
    index: number,
  ) {
    return (
      <fieldset key={index}>
        <legend>Judge {index + 1}</legend>
        <label>
          Judge {index + 1} model
          <input
            aria-label={`Judge ${index + 1} model`}
            list="mapped-model-identifiers"
            value={config.model}
            onChange={(e) => update({ ...config, model: e.target.value })}
          />
        </label>
        <SelectField
          label={`Judge ${index + 1} confidence_source`}
          value={config.confidence_source}
          choices={
            kind === "multi"
              ? ["self_rating", "token_probability", "agreement"]
              : ["self_rating", "token_probability"]
          }
          onChange={(value) => update({ ...config, confidence_source: value })}
        />
        {config.model && config.confidence_source && admissionsReady && (
          <p className="admission-status">
            Admission ·{" "}
            {(() => {
              const matching = records.filter(
                (record) => record.oracle === judgeIdentity(config, criteria),
              );
              const latest = matching.at(-1);
              return !latest
                ? "no record"
                : latest.admitted
                  ? "admitted"
                  : "not admitted";
            })()}
          </p>
        )}
      </fieldset>
    );
  }
  return (
    <section className="designer-form" aria-label="Judge configuration form">
      {prefill && (
        <div className="notice">
          <div>
            <strong>Transferred from Validator Designer</strong>
            <p>{VALIDATION_TRANSFER_REASON}</p>
            <p>
              Name: {prefill.name || prefill.identifier || "(not entered)"} ·
              version: {prefill.version || "(not entered)"} · target:{" "}
              {prefill.target || "(not entered)"}
            </p>
            <p>
              Entered description and model identifier are pre-filled below; no
              Validator was registered.
            </p>
            <details>
              <summary>Original entered draft (not saved)</summary>
              <pre className="json">{JSON.stringify(prefill, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
      <ContractField
        targets={targets}
        value={attachment}
        onChange={(value) => {
          setAttachment(value);
          load("new", targets[Number(value)]);
        }}
      />
      <SelectField
        label="Existing Expectation"
        value={selected === "new" ? "" : selected}
        omission="New Expectation"
        choices={(location?.contract.expectations ?? []).map(
          (clause: Data, index: number) => [
            String(index),
            clause.id ?? `unnamed clause ${index + 1}`,
          ],
        )}
        onChange={(value) => load(value || "new")}
      />
      <SelectField
        label="Judge type"
        value={kind}
        choices={["single", "multi"]}
        onChange={(value) => {
          setKind(value);
          if (value === "multi" && !original.multi_judge) setPurpose("");
        }}
      />
      <div className="form-grid">
        <InputField
          label="Expectation id (optional)"
          value={id}
          onChange={setId}
        />
        <SelectField
          label="Expectation dimension"
          value={dimension}
          choices={DIMENSIONS}
          omission="Omit — documented default semantic"
          onChange={setDimension}
        />
      </div>
      <InputField
        label="Judge criteria"
        value={criteria}
        onChange={setCriteria}
        rows={4}
      />
      <p className="footnote">
        Aster simulator hint (never inserted automatically): begin criteria with
        [grounding], [retrieval], [completion], [tool-argument], [over-refusal]
        or [correct-refusal]. The pinned provider protocol has no separate Judge
        prompt field; criteria is the inspectable Judge instruction.
      </p>
      <InputField
        label="Confidence threshold"
        value={threshold}
        onChange={setThreshold}
      />
      {kind === "multi" && (
        <>
          <SelectField
            label="Multi Judge purpose"
            value={purpose}
            choices={["independence", "stability"]}
            onChange={setPurpose}
          />
          <p>{PURPOSE_RULE}</p>
        </>
      )}
      {kind === "multi" && purpose === "independence" ? (
        <>
          {members.map((member, index) =>
            modelFields(
              member,
              (value) =>
                setMembers((old) =>
                  old.map((item, i) => (i === index ? value : item)),
                ),
              index,
            ),
          )}
          <button onClick={() => setMembers((old) => [...old, empty()])}>
            Add Judge configuration
          </button>
          {members.length > 2 && (
            <button onClick={() => setMembers((old) => old.slice(0, -1))}>
              Remove last Judge configuration
            </button>
          )}
        </>
      ) : (
        modelFields(single, setSingle, 0)
      )}
      <datalist id="mapped-model-identifiers">
        {Object.keys(providers).map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      {kind === "multi" && (
        <>
          {purpose === "stability" && (
            <InputField
              label="Sample count"
              value={samples}
              onChange={setSamples}
            />
          )}
          <SelectField
            label="Consensus method"
            value={method}
            choices={[
              ["voting", "Voting (voting)"],
              [
                "confidence_weighted_mean",
                "Consensus (confidence_weighted_mean)",
              ],
            ]}
            onChange={setMethod}
          />
          {method === "voting" && (
            <>
              <SelectField
                label="Voting threshold"
                value={voting}
                choices={[
                  "majority",
                  "unanimous",
                  ["fraction", "Numeric fraction"],
                ]}
                omission="Omit — engine default majority applies"
                onChange={setVoting}
              />
              {voting === "fraction" && (
                <InputField
                  label="Voting fraction"
                  value={fraction}
                  onChange={setFraction}
                />
              )}
              <p>
                {!voting
                  ? "Engine documented default: threshold majority applies; it is not written into YAML."
                  : "Threshold counts only qualified Judge verdicts; the engine performs the vote."}
              </p>
            </>
          )}
          <SelectField
            label="On disagreement"
            value={disagreement}
            choices={["human_review", "fail"]}
            omission="Omit — engine default human_review applies"
            onChange={setDisagreement}
          />
          {!disagreement && (
            <p>
              Engine documented default: on_disagreement human_review applies;
              it is not written into YAML.
            </p>
          )}
          <InputField
            label="min_qualified (optional)"
            value={quorum}
            onChange={setQuorum}
          />
          {!quorum && (
            <p>
              Omitted quorum: the engine requires the full configured panel.
            </p>
          )}
          {method === "confidence_weighted_mean" && (
            <InputField
              label="min_agreement (optional)"
              value={agreement}
              onChange={setAgreement}
            />
          )}
        </>
      )}
      {sameSubject && (
        <div role="alert" className="error">
          {INDEPENDENCE_RULE} Judge model equals a model_version in this
          Project.
        </div>
      )}
      {familyWarning && (
        <p className="notice">
          SHOULD NOT share the subject's model family: correlated blind spots
          are possible. This is an identifier-based warning, not a refusal or a
          claim of verified independence.
        </p>
      )}
      {changed && (
        <p className="notice" role="note">
          {NEW_JUDGE_WARNING}
        </p>
      )}
      {admissionsError && (
        <div role="alert" className="error">
          <pre>{admissionsError}</pre>
        </div>
      )}
      <p>
        Admission is read-only here. Each displayed status comes from the latest
        exact-configuration record returned by the engine; no agreement measures
        or thresholds are evaluated by this screen.
      </p>
    </section>
  );
}
const VALIDATION_TRANSFER_REASON =
  "Volume XV: a check that calls a model to decide pass/fail is configuring a Judge; it cannot be saved as a Validator.";
