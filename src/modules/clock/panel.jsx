import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Toggle } from "../../components/controls/Toggle.jsx";
import { Stepper } from "../../components/controls/Stepper.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = { mode: "sync", freq: 2, running: true };

const MODE_OPTIONS = [
  { value: "sync", label: "Sync", short: "SYNC" },
  { value: "free", label: "Free", short: "FREE" },
];

export function ClockPanel() {
  const { instanceId: id } = useModuleInstance();
  const params = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const bpm    = useSynthStore((s) => s.bpm);
  const setBpm = useSynthStore((s) => s.setBpm);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);
  const set = (k, v) => setModuleParam(id, k, v);

  // Blink the LED for ~80ms after each x1 beat. The module records
  // lastBeatAt on every x1 rising edge; the panel polls it per frame.
  const [lit, setLit] = useState(false);
  const rafRef = useRef(0);
  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const recent = !!(m && performance.now() - m.lastBeatAt < 80);
      setLit((prev) => (prev === recent ? prev : recent));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  const isSync = params.mode === "sync";

  return (
    <div className="clock-body">
      <div className="clock-lamp-row">
        <span className={"clock-lamp" + (lit ? " on" : "")} />
        <span className="clock-lamp-label">
          {isSync ? `${bpm} bpm` : `${params.freq.toFixed(2)} Hz`}
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
            value={params.freq}
            min={0.1} max={20} step={0.05}
            unit="Hz" log
            onChange={(v) => set("freq", v)}
          />
        </div>
      )}
    </div>
  );
}
