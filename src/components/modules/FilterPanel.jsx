import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
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

  // Live cutoff/q getters reflect the post-CV-mix values: intrinsic AudioParam
  // (driven by the knob) plus the tapped CV contribution. The Canvas's rAF
  // loop reads via the getters every frame, so the response curve animates
  // with any wired LFO / env / S&H modulation.
  const engine = getEngine();
  const data = {
    get cutoff() {
      const m = engine.getGraph().getModule(id);
      if (!m) return params.cutoff;
      const intrinsic = m.node?.frequency?.value ?? params.cutoff;
      const cv = m.getCvLevel?.("cutoff") ?? 0;
      return Math.max(20, intrinsic + cv);
    },
    get q() {
      const m = engine.getGraph().getModule(id);
      if (!m) return params.q;
      const intrinsic = m.node?.Q?.value ?? params.q;
      const cv = m.getCvLevel?.("resonance") ?? 0;
      return Math.max(0.1, intrinsic + cv);
    },
    mode:   params.mode,
    // Canonical-only LFO overlay stays as a static modulation-range reference
    // (the live curve already shows the instantaneous post-CV cutoff, but the
    // overlay helps show "how wide the sweep is" at a glance).
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
