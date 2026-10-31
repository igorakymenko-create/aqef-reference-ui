// Presentation only. Stored values and API request payloads retain full precision.
export function figure(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(3)
    : value === undefined || value === null
      ? "not recorded"
      : String(value);
}
