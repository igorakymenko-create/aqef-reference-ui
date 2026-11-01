import { figure } from "../format";
import { routeLink, type Evaluation } from "./api";

// Chart coordinates only; these operations do not compute an AQEF Metric.
export function linePath(values: (number | null)[]) {
  const numbers = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (!numbers.length) return "";
  const low = Math.min(...numbers),
    high = Math.max(...numbers),
    range = high - low || 1;
  let connected = false,
    path = "";
  values.forEach((value, index) => {
    if (value === null) {
      connected = false;
      return;
    }
    const x = 20 + (index / Math.max(1, values.length - 1)) * 520,
      y = 100 - ((value - low) / range) * 75;
    path += `${connected ? " L" : " M"}${x},${y}`;
    connected = true;
  });
  return path.trim();
}
export function Trend({
  project,
  views,
}: {
  project: string;
  views: Evaluation[];
}) {
  const ordered = views.filter((v) => v.at),
    names = [...new Set(ordered.flatMap((v) => Object.keys(v.gates ?? {})))];
  return (
    <section className="gate-trends" aria-label="Gate Trends">
      <h2>Gate values in evaluation order</h2>
      <p>
        <strong>values as evaluated by the engine</strong>
      </p>
      <p>
        Only returned evaluations and saved Report copies with an engine
        timestamp are available. not_computed is a gap in the line, never zero.
      </p>
      {!ordered.length && <p>No timestamped evaluation values returned.</p>}
      {names.flatMap((name) => {
        const keys = [
          ...new Set(
            ordered.flatMap((v) => {
              const value = v.gates?.[name]?.value;
              return value && typeof value === "object"
                ? Object.keys(value)
                : [];
            }),
          ),
        ];
        return (keys.length ? keys : [""]).map((key) => {
          const values = ordered.map((v) => {
            const value = v.gates?.[name]?.value,
              item =
                key && value && typeof value === "object"
                  ? value[key]
                  : key
                    ? undefined
                    : value;
            return typeof item === "number" && Number.isFinite(item)
              ? item
              : null;
          });
          return (
            <figure key={name + "/" + key} className="trend">
              <figcaption>
                {name}
                {key ? ` · ${key}` : ""}
              </figcaption>
              <svg
                viewBox="0 0 560 125"
                role="img"
                aria-label={`Engine values for ${name}${key ? "/" + key : ""}`}
              >
                <path
                  d={linePath(values)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  data-testid="trend-path"
                />
              </svg>
              <ol>
                {ordered.map((view, index) => (
                  <li
                    key={view.snapshot}
                    data-value={
                      values[index] === null
                        ? "not_computed"
                        : String(values[index])
                    }
                  >
                    <a
                      href={routeLink(
                        "gates",
                        project,
                        view.batch,
                        view.snapshot,
                        "results",
                      )}
                    >
                      {view.timeKind}: {view.at} ·{" "}
                      {values[index] === null
                        ? "not_computed / no numeric value returned"
                        : figure(values[index])}{" "}
                      · Snapshot {view.snapshot}
                    </a>
                  </li>
                ))}
              </ol>
            </figure>
          );
        });
      })}
    </section>
  );
}
