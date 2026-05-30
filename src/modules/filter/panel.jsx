import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Toggle } from "../../components/controls/Toggle.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawFilter } from "../../components/viz/drawFilter.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";
import { isCanonicalPresent } from "../_registry.js";

const FILTER_MODES = [
  { value: "lowpass",  label: "Low-pass",  short: "LP" },
  { value: "highpass", label: "High-pass", short: "HP" }
];

const DEFAULT_PARAMS = { cutoff: 1200, resonance: 1, mode: "lowpass" };

export function FilterPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.filter;
  const isCanonical = id === CANONICAL_IDS.filter;

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  // Canonical LFO overlay on the response: only shown for the canonical filter
  // when the canonical LFO exists (it visualises the chapter-mode auto-wired
  // LFO→cutoff modulation range).
  const lfoParams = useSynthStore((s) => s.modules.find((m) => m.id === CANONICAL_IDS.lfo)?.params);
  const lfoOn     = useSynthStore((s) => isCanonicalPresent(CANONICAL_IDS.lfo, s.modules));
  const playing   = useSynthStore((s) => s.playing);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  // Live cutoff/resonance getters reflect post-CV-mix values: intrinsic AudioParam
  // (knob) plus tapped CV contribution. Canvas's rAF loop reads via getters
  // every frame, so the response curve animates with any wired modulation.
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
      if (!m) return params.resonance;
      const intrinsic = m.node?.Q?.value ?? params.resonance;
      const cv = m.getCvLevel?.("resonance") ?? 0;
      return Math.max(0.1, intrinsic + cv);
    },
    mode:   params.mode,
    lfo:    isCanonical && lfoOn ? lfoParams : null,
    playing,
  };

  return (
    <>
      <Canvas tag="Frequency response" draw={drawFilter} data={data} />
      <Toggle options={FILTER_MODES} value={params.mode} onChange={(v) => setModuleParam(id, "mode", v)} />
      <div className="ctrl-grid">
        <Knob label="Cutoff"    value={params.cutoff}    min={80}  max={12000} unit="Hz" log onChange={(v) => setModuleParam(id, "cutoff", v)} />
        <Knob label="Resonance" value={params.resonance} min={0.1} max={18}    step={0.1} unit="Q" onChange={(v) => setModuleParam(id, "resonance", v)} />
      </div>
    </>
  );
}
