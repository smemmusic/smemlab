import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Toggle } from "../../components/controls/Toggle.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawFilter } from "../../components/viz/drawFilter.js";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../content/puzzleHooks.js";

const FILTER_MODES = [
  { value: "lowpass",  label: "Low-pass",  short: "LP" },
  { value: "highpass", label: "High-pass", short: "HP" }
];

export function FilterPanel() {
  const [params, setParam, id] = useModuleParams();
  const show = usePuzzleShow(id);

  // LFO overlay on the response curve: find an LFO module wired to this
  // filter's cutoff port. The overlay visualises that modulation's range.
  // We resolve the source module's params by id from the matching connection.
  const lfoParams = useSynthStore((s) => {
    const conn = s.connections.find((c) => c.toId === id && c.toPort === "cutoff");
    if (!conn) return null;
    const src = s.modules.find((m) => m.id === conn.fromId);
    return src?.type === "lfo" ? src.params : null;
  });
  const playing   = useSynthStore((s) => s.playing);

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
    lfo:    lfoParams,
    playing,
  };

  const showCutoff    = show("cutoff");
  const showResonance = show("resonance");
  return (
    <>
      {show("response") && <Canvas tag="Frequency response" draw={drawFilter} data={data} />}
      {show("mode")     && <Toggle options={FILTER_MODES} value={params.mode} onChange={(v) => setParam("mode", v)} />}
      {(showCutoff || showResonance) && (
        <div className={"ctrl-grid" + (showCutoff && showResonance ? "" : " one")}>
          {showCutoff    && <Knob label="Cutoff"    value={params.cutoff}    min={80}  max={12000} unit="Hz" log onChange={(v) => setParam("cutoff", v)} />}
          {showResonance && <Knob label="Resonance" value={params.resonance} min={0.1} max={18}    step={0.1} unit="Q" onChange={(v) => setParam("resonance", v)} />}
        </div>
      )}
    </>
  );
}
