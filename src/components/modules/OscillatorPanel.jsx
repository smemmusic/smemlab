import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../controls/Knob.jsx";
import { Selector } from "../controls/Selector.jsx";
import { Oscilloscope } from "../viz/Oscilloscope.jsx";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const SHAPES = [
  { value: "sine",     label: "Sine",  wf: "sine" },
  { value: "sawtooth", label: "Saw",   wf: "sawtooth" },
  { value: "square",   label: "Sq",    wf: "square" },
  { value: "triangle", label: "Tri",   wf: "triangle" },
  { value: "noise",    label: "Noise", wf: "noise" }
];

const DEFAULT_PARAMS = { type: "sawtooth", freq: 110 };

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
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.osc;
  const isCanonical = id === CANONICAL_IDS.osc;

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  // Keyboard override only applies to the canonical oscillator (the chapter
  // flow's pitch destination). Free-mode oscillators are not driven by the
  // global keyboard, so they keep showing their freq knob.
  const kbOn    = useSynthStore((s) => s.blocks.keyboard) && isCanonical;
  const setOscType = useSynthStore((s) => s.setOscType);
  const setOscFreq = useSynthStore((s) => s.setOscFreq);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  const setType = isCanonical ? setOscType : (v) => setModuleParam(id, "type", v);
  const setFreq = isCanonical ? setOscFreq : (v) => setModuleParam(id, "freq", v);

  const isNoise = params.type === "noise";

  let pitchControl;
  if (isNoise)      pitchControl = <PitchPlaceholder caption="no pitch" />;
  else if (kbOn)    pitchControl = <PitchPlaceholder caption="from keyboard" />;
  else              pitchControl = <Knob label="Pitch" value={params.freq} min={55} max={880} unit="Hz" log onChange={setFreq} />;

  return (
    <>
      <Oscilloscope tag="Oscilloscope · raw output" instanceId={id} />
      <Selector options={SHAPES} value={params.type} onChange={setType} />
      <div className="ctrl-grid one">{pitchControl}</div>
    </>
  );
}
