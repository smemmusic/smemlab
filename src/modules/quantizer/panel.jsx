import { useEffect, useRef, useState } from "react";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Selector } from "../../components/controls/Selector.jsx";
import { Stepper } from "../../components/controls/Stepper.jsx";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_OPTIONS = [
  { value: "chromatic",  label: "Chr" },
  { value: "major",      label: "Maj" },
  { value: "minor",      label: "Min" },
  { value: "pentatonic", label: "Pent" },
];

// Semitones above the oscillator's base note → a readable note name. The base
// note is arbitrary (the quantizer only emits an interval), so this is for
// orientation, not absolute pitch — octave numbering starts at the base.
function noteName(semi) {
  const n = ((semi % 12) + 12) % 12;
  const oct = Math.floor(semi / 12);
  return `${NOTE_NAMES[n]}${oct >= 0 ? "+" + oct : oct}`;
}

export function QuantizerPanel() {
  const [params, setParam, id] = useModuleParams();

  const [note, setNote] = useState(0);
  const rafRef = useRef(0);
  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const n = m?.note ?? 0;
      setNote((prev) => (prev === n ? prev : n));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  return (
    <div className="quant-body">
      <div className="quant-readout">{noteName(note)}</div>
      <Selector
        options={SCALE_OPTIONS}
        value={params.scale ?? "major"}
        onChange={(v) => setParam("scale", v)}
      />
      <Stepper
        label="Root"
        value={params.root ?? 0}
        min={0} max={11}
        format={(v) => NOTE_NAMES[((v % 12) + 12) % 12]}
        onChange={(v) => setParam("root", v)}
      />
      <div className="ctrl-grid one">
        <Knob
          label="Range"
          value={params.range ?? 24}
          min={12} max={36} step={1}
          unit="st"
          onChange={(v) => setParam("range", v)}
        />
      </div>
      <div className="quant-hint">snap to scale</div>
    </div>
  );
}
