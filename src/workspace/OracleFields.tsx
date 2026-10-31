import type { Data } from "./model";
import type { Target } from "./contractEditing";
export type OracleFormProps = {
  content: string;
  roots: Map<string, Data>;
  providers: Record<string, string>;
  onChange: (content: string) => void;
  onError: (error: string) => void;
};
export function SelectField({
  label,
  value,
  choices,
  onChange,
  omission = "Choose explicitly…",
}: {
  label: string;
  value: string;
  choices: (string | [string, string])[];
  onChange: (value: string) => void;
  omission?: string;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{omission}</option>
        {choices.map((choice) => {
          const [value, label] = Array.isArray(choice)
            ? choice
            : [choice, choice];
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function ContractField({
  targets,
  value,
  onChange,
}: {
  targets: Target[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField
      label="Contract attachment"
      value={value}
      choices={targets.map((target, index) => [String(index), target.label])}
      onChange={onChange}
    />
  );
}
export function InputField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label>
      {label}
      {rows ? (
        <textarea
          aria-label={label}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export const DIMENSIONS = ["functional", "semantic", "operational", "safety"];
export const incomplete = (fields: string[]) =>
  `Form incomplete — choose: ${fields.join(", ")}. No YAML is proposed yet.`;
