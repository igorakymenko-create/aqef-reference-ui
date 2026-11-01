// Presentation only. Stored values and API request payloads retain full precision.
export function oracleName(value: unknown): string {
  if (typeof value !== "string") return "configuration not returned";
  try {
    const oracle = JSON.parse(value);
    return (
      [
        oracle.model ?? oracle.name ?? oracle.role ?? oracle.type,
        oracle.criteria,
      ]
        .filter(Boolean)
        .join(" · ") || value
    );
  } catch {
    return value;
  }
}
export function figure(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(3)
    : value === undefined || value === null
      ? "not recorded"
      : String(value);
}
