import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Selector } from "../controls/Selector.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawLfo } from "../viz/drawLfo.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const LFO_SHAPES = [
  { value: "sine",     label: "Sine", wf: "sine" },
  { value: "triangle", label: "Tri",  wf: "triangle" },
  { value: "sawtooth", label: "Saw",  wf: "sawtooth" },
  { value: "square",   label: "Sq",   wf: "square" }
];

const DEFAULT_PARAMS = { rate: 5, depth: 0.4, shape: "sine" };

export function LfoPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.lfo;
  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);
  const setLfo = useSynthStore((s) => s.setLfo);

  // For the canonical LFO instance, dual-write through the legacy setLfo
  // action so the legacy `s.lfo` slot stays in sync (used by presets +
  // savePreset). Free-mode instances write only to their own module params.
  function applyPartial(partial) {
    if (id === CANONICAL_IDS.lfo) {
      setLfo(partial);
    } else {
      for (const [k, v] of Object.entries(partial)) setModuleParam(id, k, v);
    }
  }

  const data = { lfo: params, edge, threshold };

  return (
    <>
      <Canvas tag="Low-frequency oscillator" draw={drawLfo} data={data} />
      <Selector options={LFO_SHAPES} value={params.shape} onChange={(v) => applyPartial({ shape: v })} />
      <div className="ctrl-grid">
        <Knob label="Rate"  value={params.rate}  min={0.1} max={20} step={0.1} unit="Hz" log onChange={(v) => applyPartial({ rate: v })} />
        <Knob label="Depth" value={params.depth} min={0}   max={1}  step={0.01} unit="%" onChange={(v) => applyPartial({ depth: v })} />
      </div>
    </>
  );
}
