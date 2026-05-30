import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Selector } from "../controls/Selector.jsx";
import { Oscilloscope } from "../viz/Oscilloscope.jsx";

const SHAPES = [
  { value: "sine",     label: "Sine", wf: "sine" },
  { value: "sawtooth", label: "Saw",  wf: "sawtooth" },
  { value: "square",   label: "Sq",   wf: "square" },
  { value: "triangle", label: "Tri",  wf: "triangle" }
];

export function OscillatorPanel() {
  const osc        = useSynthStore((s) => s.osc);
  const setOscType = useSynthStore((s) => s.setOscType);
  const setOscFreq = useSynthStore((s) => s.setOscFreq);

  return (
    <>
      <Oscilloscope tag="Oscilloscope · raw output" analyserName="osc" />
      <Selector options={SHAPES} value={osc.type} onChange={setOscType} />
      <div className="ctrl-grid one">
        <Knob label="Pitch" value={osc.freq} min={55} max={880} unit="Hz" log onChange={setOscFreq} />
      </div>
    </>
  );
}
