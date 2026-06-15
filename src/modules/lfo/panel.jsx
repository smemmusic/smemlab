import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Selector } from "../../components/controls/Selector.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawLfo } from "../../components/viz/drawLfo.js";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../content/puzzleHooks.js";

const LFO_SHAPES = [
  { value: "sine",     label: "Sine", wf: "sine" },
  { value: "triangle", label: "Tri",  wf: "triangle" },
  { value: "sawtooth", label: "Saw",  wf: "sawtooth" },
  { value: "square",   label: "Sq",   wf: "square" }
];

export function LfoPanel() {
  const [params, setParam, id] = useModuleParams();
  const show = usePuzzleShow(id);

  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);

  function applyPartial(partial) {
    for (const [k, v] of Object.entries(partial)) setParam(k, v);
  }

  const data = { lfo: params, edge, threshold };

  const showRate  = show("rate");
  const showDepth = show("depth");
  return (
    <>
      {show("scope") && <Canvas tag="Low-frequency oscillator" draw={drawLfo} data={data} />}
      {show("shape") && <Selector options={LFO_SHAPES} value={params.shape} onChange={(v) => applyPartial({ shape: v })} />}
      {(showRate || showDepth) && (
        <div className={"ctrl-grid" + (showRate && showDepth ? "" : " one")}>
          {showRate  && <Knob label="Rate"  value={params.rate}  min={0.1} max={20} step={0.1}  unit="Hz" log onChange={(v) => applyPartial({ rate: v })} />}
          {showDepth && <Knob label="Depth" value={params.depth} min={0}   max={1}  step={0.01} unit="%" onChange={(v) => applyPartial({ depth: v })} />}
        </div>
      )}
    </>
  );
}
