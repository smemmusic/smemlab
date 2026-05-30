import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Selector } from "../controls/Selector.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawLfo } from "../viz/drawLfo.js";

const LFO_SHAPES = [
  { value: "sine",     label: "Sine", wf: "sine" },
  { value: "triangle", label: "Tri",  wf: "triangle" },
  { value: "sawtooth", label: "Saw",  wf: "sawtooth" },
  { value: "square",   label: "Sq",   wf: "square" }
];

export function LfoPanel() {
  const lfo       = useSynthStore((s) => s.lfo);
  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const setLfo    = useSynthStore((s) => s.setLfo);

  const data = { lfo, edge, threshold };

  return (
    <>
      <Canvas tag="Low-frequency oscillator" draw={drawLfo} data={data} />
      <Selector options={LFO_SHAPES} value={lfo.shape} onChange={(v) => setLfo({ shape: v })} />
      <div className="ctrl-grid">
        <Knob label="Rate"  value={lfo.rate}  min={0.1} max={20} step={0.1} unit="Hz" log onChange={(v) => setLfo({ rate: v })} />
        <Knob label="Depth" value={lfo.depth} min={0}   max={1}  step={0.01} unit="%" onChange={(v) => setLfo({ depth: v })} />
      </div>
    </>
  );
}
