import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Selector } from "../../components/controls/Selector.jsx";
import { Stepper } from "../../components/controls/Stepper.jsx";
import { Oscilloscope } from "../../components/viz/Oscilloscope.jsx";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../content/puzzleHooks.js";

const SHAPES = [
  { value: "sine",     label: "Sine",  wf: "sine" },
  { value: "sawtooth", label: "Saw",   wf: "sawtooth" },
  { value: "square",   label: "Sq",    wf: "square" },
  { value: "triangle", label: "Tri",   wf: "triangle" },
  { value: "noise",    label: "Noise", wf: "noise" }
];

const OCTAVE_MIN = -2;
const OCTAVE_MAX = 2;
const fmtOctave = (v) => (v > 0 ? `+${v}` : `${v}`);

function PitchPlaceholder({ caption }) {
  return (
    <div className="knob">
      <div className="dial placeholder" aria-disabled="true">
        <span className="ticks" />
      </div>
      <div className="lab">Pitch</div>
      <div className="val">{caption}</div>
    </div>
  );
}

export function OscillatorPanel() {
  const [params, setParam, id] = useModuleParams();
  const show = usePuzzleShow(id);

  // Show the "from keyboard" override when a keyboard module is wired into
  // THIS oscillator's pitch port. Works for any pairing, multi-instance safe.
  const kbOn = useSynthStore((s) => s.connections.some((c) => {
    if (c.toId !== id || c.toPort !== "pitch") return false;
    const src = s.modules.find((m) => m.id === c.fromId);
    return src?.type === "keyboard";
  }));
  const octave = params.octave ?? 0;
  const setOctave = (v) => setParam("octave", v);

  const isNoise = params.type === "noise";

  let pitchControl;
  if (isNoise)      pitchControl = <PitchPlaceholder caption="no pitch" />;
  else if (kbOn)    pitchControl = <PitchPlaceholder caption="from keyboard" />;
  else              pitchControl = <Knob label="Pitch" value={params.freq} min={20} max={12000} unit="Hz" log onChange={(v) => setParam("freq", v)} />;

  return (
    <>
      {show("scope")  && <Oscilloscope tag="Oscilloscope · raw output" instanceId={id} />}
      {show("type")   && <Selector options={SHAPES} value={params.type} onChange={(v) => setParam("type", v)} />}
      {show("freq")   && <div className="ctrl-grid one">{pitchControl}</div>}
      {show("octave") && (
        <Stepper
          label="Octave"
          value={octave}
          min={OCTAVE_MIN}
          max={OCTAVE_MAX}
          format={fmtOctave}
          onChange={setOctave}
        />
      )}
    </>
  );
}
