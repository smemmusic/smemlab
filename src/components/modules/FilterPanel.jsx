import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Toggle } from "../controls/Toggle.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawFilter } from "../viz/drawFilter.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const FILTER_MODES = [
  { value: "lowpass",  label: "Low-pass",  short: "LP" },
  { value: "highpass", label: "High-pass", short: "HP" }
];

const DEFAULT_PARAMS = { cutoff: 1200, q: 1, mode: "lowpass" };

export function FilterPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.filter;
  const isCanonical = id === CANONICAL_IDS.filter;

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const lfo     = useSynthStore((s) => s.lfo);
  const lfoOn   = useSynthStore((s) => s.blocks.lfo);
  const playing = useSynthStore((s) => s.playing);
  const setCutoff = useSynthStore((s) => s.setCutoff);
  const setQ      = useSynthStore((s) => s.setQ);
  const setMode   = useSynthStore((s) => s.setMode);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  const applyCutoff = isCanonical ? setCutoff : (v) => setModuleParam(id, "cutoff", v);
  const applyQ      = isCanonical ? setQ      : (v) => setModuleParam(id, "q", v);
  const applyMode   = isCanonical ? setMode   : (v) => setModuleParam(id, "mode", v);

  const data = {
    cutoff: params.cutoff,
    q:      params.q,
    mode:   params.mode,
    // LFO overlay on frequency response only shown on the canonical filter
    // (where the chapter-mode LFO → cutoff wiring lives).
    lfo:    isCanonical && lfoOn ? lfo : null,
    playing
  };

  return (
    <>
      <Canvas tag="Frequency response" draw={drawFilter} data={data} />
      <Toggle options={FILTER_MODES} value={params.mode} onChange={applyMode} />
      <div className="ctrl-grid">
        <Knob label="Cutoff"    value={params.cutoff} min={80}  max={12000} unit="Hz" log onChange={applyCutoff} />
        <Knob label="Resonance" value={params.q}      min={0.1} max={18}    step={0.1} unit="Q" onChange={applyQ} />
      </div>
    </>
  );
}
