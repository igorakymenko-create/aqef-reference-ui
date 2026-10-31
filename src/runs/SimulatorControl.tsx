import { useEffect, useState } from "react";
import { request } from "./api";
import { Failure } from "./ExecutionView";
export function SimulatorControl({ onChange }: { onChange: () => void }) {
  const [unavailable, setUnavailable] = useState<boolean>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  useEffect(() => {
    request("/sim-control/flaky")
      .then((data) => setUnavailable(data.unavailable))
      .catch(setError);
  }, []);
  async function change(value: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const state = await request("/sim-control/flaky", { unavailable: value });
      setUnavailable(state.unavailable);
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="simulator-control" aria-label="Simulator control">
      <p className="eyebrow">SIMULATOR CONTROL / NOT AN AQEF FEATURE</p>
      <h2>Recoverable Judge outage</h2>
      <p>
        <code>aster-sim-judge-flaky@1</code> returns HTTP 503 while the outage
        switch is on. Only switching it off restores answers; running or
        re-checking never resets it. The down Judge remains permanently
        unavailable.
      </p>
      <p>
        Flaky outage:{" "}
        <strong>
          {unavailable === undefined ? "unknown" : unavailable ? "on" : "off"}
        </strong>
      </p>
      <div className="button-row">
        <button
          disabled={busy || unavailable === false}
          onClick={() => void change(false)}
        >
          Turn flaky outage off
        </button>
        <button
          disabled={busy || unavailable === true}
          onClick={() => void change(true)}
        >
          Turn flaky outage on
        </button>
      </div>
      {Boolean(error) && <Failure error={error} />}
    </section>
  );
}
