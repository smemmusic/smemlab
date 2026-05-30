import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Toggle } from "../controls/Toggle.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawFilter } from "../viz/drawFilter.js";

const FILTER_MODES = [
  { value: "lowpass",  label: "Low-pass",  short: "LP" },
  { value: "highpass", label: "High-pass", short: "HP" }
];

export function FilterPanel() {
  const flt       = useSynthStore((s) => s.flt);
  const lfo       = useSynthStore((s) => s.lfo);
  const lfoOn     = useSynthStore((s) => s.blocks.lfo);
  const playing   = useSynthStore((s) => s.playing);
  const setCutoff = useSynthStore((s) => s.setCutoff);
  const setQ      = useSynthStore((s) => s.setQ);
  const setMode   = useSynthStore((s) => s.setMode);

  const data = {
    cutoff: flt.cutoff,
    q:      flt.q,
    mode:   flt.mode,
    lfo:    lfoOn ? lfo : null,
    playing
  };

  return (
    <>
      <Canvas tag="Frequency response" draw={drawFilter} data={data} />
      <Toggle options={FILTER_MODES} value={flt.mode} onChange={setMode} />
      <div className="ctrl-grid">
        <Knob label="Cutoff"    value={flt.cutoff} min={80}  max={12000} unit="Hz" log onChange={setCutoff} />
        <Knob label="Resonance" value={flt.q}      min={0.1} max={18}    step={0.1} unit="Q" onChange={setQ} />
      </div>
    </>
  );
}
