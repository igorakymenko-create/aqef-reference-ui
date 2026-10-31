import type { RecordData } from "../runs/api";
export function excluded(item: RecordData, oracle: string) {
  const model = JSON.parse(oracle).model;
  return (
    item.exposed === true &&
    (!item.exposed_for?.length ||
      item.exposed_for.includes(oracle) ||
      item.exposed_for.includes(model))
  );
}
export function agreement(items: RecordData[], scores: RecordData[]) {
  const table = [
      [0, 0],
      [0, 0],
    ],
    missing: string[] = [];
  items.forEach((item) => {
    const score = scores.find((s) => s.item === item.id);
    if (!["pass", "fail"].includes(score?.verdict)) {
      missing.push(item.id);
      return;
    }
    table[item.label === "pass" ? 0 : 1][score!.verdict === "pass" ? 0 : 1]++;
  });
  const [[a, b], [c, d]] = table,
    n = items.length,
    hp = items.filter((i) => i.label === "pass").length,
    hf = items.filter((i) => i.label === "fail").length,
    jp = a + c,
    jf = b + d;
  const raw = missing.length ? null : (a + d) / n,
    expected = missing.length ? null : (hp * jp + hf * jf) / (n * n);
  const kappa: number | "not_computed" =
    raw === null || expected === null || !hp || !hf || expected === 1
      ? "not_computed"
      : (raw - expected) / (1 - expected);
  return { table, n, hp, hf, jp, jf, raw, expected, kappa, missing };
}
export function propose(path: string, content: string) {
  const event = new CustomEvent("aqef-propose-source", {
    detail: { path, content },
    cancelable: true,
  });
  if (window.dispatchEvent(event)) location.hash = "workspace";
}
