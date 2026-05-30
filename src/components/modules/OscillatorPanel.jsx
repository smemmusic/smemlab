import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Selector } from "../controls/Selector.jsx";
import { Oscilloscope } from "../viz/Oscilloscope.jsx";

const SHAPES = [
  { value: "sine",     label: "Sine",  wf: "sine" },
  { value: "sawtooth", label: "Saw",   wf: "sawtooth" },
  { value: "square",   label: "Sq",    wf: "square" },
  { value: "triangle", label: "Tri",   wf: "triangle" },
  { value: "noise",    label: "Noise", wf: "noise" }
];

// Static placeholder for the Pitch knob position when the source is noise —
// noise has no fundamental, so there's nothing for Pitch to control.
function PitchUnavailable() {
  return (
    <div className="knob">
      <div className="dial" style={{ opacity: 0.35, cursor: "default" }} aria-disabled="true">
        <span className="ticks" />
      </div>
      <div className="lab">Pitch</div>
      <div className="val">no pitch</div>
    </div>
  );
}

export function OscillatorPanel() {
  const osc        = useSynthStore((s) => s.osc);
  const setOscType = useSynthStore((s) => s.setOscType);
  const setOscFreq = useSynthStore((s) => s.setOscFreq);

  const isNoise = osc.type === "noise";

  return (
    <>
      <Oscilloscope tag="Oscilloscope · raw output" analyserName="osc" />
      <Selector options={SHAPES} value={osc.type} onChange={setOscType} />
      <div className="ctrl-grid one">
        {isNoise
          ? <PitchUnavailable />
          : <Knob label="Pitch" value={osc.freq} min={55} max={880} unit="Hz" log onChange={setOscFreq} />}
      </div>
    </>
  );
}
