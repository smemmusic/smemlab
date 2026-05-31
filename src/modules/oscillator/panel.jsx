import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Selector } from "../../components/controls/Selector.jsx";
import { Stepper } from "../../components/controls/Stepper.jsx";
import { Oscilloscope } from "../../components/viz/Oscilloscope.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const SHAPES = [
  { value: "sine",     label: "Sine",  wf: "sine" },
  { value: "sawtooth", label: "Saw",   wf: "sawtooth" },
  { value: "square",   label: "Sq",    wf: "square" },
  { value: "triangle", label: "Tri",   wf: "triangle" },
  { value: "noise",    label: "Noise", wf: "noise" }
];

const DEFAULT_PARAMS = { type: "sawtooth", freq: 110, octave: 0 };
const OCTAVE_MIN = -2;
const OCTAVE_MAX = 2;
const fmtOctave = (v) => (v > 0 ? `+${v}` : `${v}`);

function PitchPlaceholder({ caption }) {
  return (
    <div className="knob">
      <div className="dial" style={{ opacity: 0.35, cursor: "default" }} aria-disabled="true">
        <span className="ticks" />
      </div>
      <div className="lab">Pitch</div>
      <div className="val">{caption}</div>
    </div>
  );
}

export function OscillatorPanel() {
  const { instanceId: id } = useModuleInstance();

  const params = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  // Show the "from keyboard" override when a keyboard module is wired into
  // THIS oscillator's pitch port. Works for any pairing, multi-instance safe.
  const kbOn = useSynthStore((s) => s.connections.some((c) => {
    if (c.toId !== id || c.toPort !== "pitch") return false;
    const src = s.modules.find((m) => m.id === c.fromId);
    return src?.type === "keyboard";
  }));
  const setModuleParam = useSynthStore((s) => s.setModuleParam);
  const octave = params.octave ?? 0;
  const setOctave = (v) => setModuleParam(id, "octave", v);

  const isNoise = params.type === "noise";

  let pitchControl;
  if (isNoise)      pitchControl = <PitchPlaceholder caption="no pitch" />;
  else if (kbOn)    pitchControl = <PitchPlaceholder caption="from keyboard" />;
  else              pitchControl = <Knob label="Pitch" value={params.freq} min={55} max={880} unit="Hz" log onChange={(v) => setModuleParam(id, "freq", v)} />;

  return (
    <>
      <Oscilloscope tag="Oscilloscope · raw output" instanceId={id} />
      <Selector options={SHAPES} value={params.type} onChange={(v) => setModuleParam(id, "type", v)} />
      <div className="ctrl-grid one">{pitchControl}</div>
      <Stepper
        label="Octave"
        value={octave}
        min={OCTAVE_MIN}
        max={OCTAVE_MAX}
        format={fmtOctave}
        onChange={setOctave}
      />
    </>
  );
}
