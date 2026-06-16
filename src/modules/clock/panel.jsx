import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Toggle } from "../../components/controls/Toggle.jsx";
import { Stepper } from "../../components/controls/Stepper.jsx";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";

const MODE_OPTIONS = [
  { value: "sync", label: "Sync", short: "SYNC" },
  { value: "free", label: "Free", short: "FREE" },
];

export function ClockPanel() {
  const [params, set, id] = useModuleParams();
  const bpm    = useSynthStore((s) => s.bpm);
  const setBpm = useSynthStore((s) => s.setBpm);

  // Blink the LED for ~80ms after each x1 beat. The worklet posts an
  // incrementing beat counter on every x1 rising edge; the panel watches it
  // change and lights the lamp for a short window.
  const [lit, setLit] = useState(false);
  const rafRef = useRef(0);
  const lastBeat = useRef(-1);
  const litUntil = useRef(0);
  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const beat = m?.getBeat?.() ?? 0;
      const now = performance.now();
      if (beat !== lastBeat.current) { lastBeat.current = beat; litUntil.current = now + 80; }
      const recent = now < litUntil.current;
      setLit((prev) => (prev === recent ? prev : recent));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  const isSync = params.mode === "sync";
  // Fall back to the default rate if a patch added the clock without a freq
  // param (e.g. a journey delta) — Free mode reads it directly.
  const freq = params.freq ?? 2;

  return (
    <div className="clock-body">
      <div className="clock-lamp-row">
        <span className={"clock-lamp" + (lit ? " on" : "")} />
        <span className="clock-lamp-label">
          {isSync ? `${bpm} bpm` : `${freq.toFixed(2)} Hz`}
        </span>
        <button
          type="button"
          className={"clock-run-btn" + (params.running ? " on" : "")}
          onClick={() => set("running", !params.running)}
          title={params.running ? "Stop the clock" : "Start the clock"}
          aria-label={params.running ? "Stop clock" : "Start clock"}
        >
          {params.running ? "■" : "▶"}
        </button>
      </div>
      <Toggle
        options={MODE_OPTIONS}
        value={params.mode}
        onChange={(v) => set("mode", v)}
      />
      {isSync ? (
        <Stepper
          label="BPM"
          value={bpm}
          min={20}
          max={300}
          format={(v) => String(v)}
          onChange={setBpm}
        />
      ) : (
        <div className="ctrl-grid one">
          <Knob
            label="Freq"
            value={freq}
            min={0.1} max={20} step={0.05}
            unit="Hz" log
            format={(v) => `${v.toFixed(2)} Hz`}
            onChange={(v) => set("freq", v)}
          />
        </div>
      )}
    </div>
  );
}
