import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Selector } from "../../components/controls/Selector.jsx";
import { Oscilloscope } from "../../components/viz/Oscilloscope.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";
import { isCanonicalPresent } from "../_registry.js";

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

  const params = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  // Keyboard override is shown only when the canonical oscillator is in chapter
  // mode with a canonical keyboard module wired up. Free-mode oscillators are
  // never driven by the global keyboard.
  const kbOn = useSynthStore((s) => isCanonicalPresent(CANONICAL_IDS.keyboard, s.modules)) && isCanonical;
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

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
    </>
  );
}
