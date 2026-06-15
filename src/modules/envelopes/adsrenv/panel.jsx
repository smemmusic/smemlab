import { useSynthStore } from "../../../store/useSynthStore.js";
import { getEngine } from "../../../audio/engineSingleton.js";
import { Knob } from "../../../components/controls/Knob.jsx";
import { Canvas } from "../../../components/viz/Canvas.jsx";
import { drawEnv } from "../../../components/viz/drawEnv.js";
import { useModuleParams } from "../../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../../content/puzzleHooks.js";

export function AdsrEnvelopePanel() {
  const [params, setParam, id] = useModuleParams();
  const show = usePuzzleShow(id);

  const playing = useSynthStore((s) => s.playing);

  function applyPartial(partial) {
    for (const [k, v] of Object.entries(partial)) setParam(k, v);
  }

  const engine = getEngine();
  // Phase + start read from the engine module directly (updated by onGate).
  const data = {
    env: params, playing,
    get phase() { return engine.getInstanceEnvPhase(id); },
    get start() { return engine.getInstanceEnvStart(id); },
  };

  const knobs = [
    show("a") && <Knob key="a" label="Attack"  value={params.a} min={0} max={2} step={0.005} unit="s"  onChange={(v) => applyPartial({ a: v })} />,
    show("d") && <Knob key="d" label="Decay"   value={params.d} min={0} max={2} step={0.005} unit="s"  onChange={(v) => applyPartial({ d: v })} />,
    show("s") && <Knob key="s" label="Sustain" value={params.s} min={-48} max={0} step={0.5} unit="dB" onChange={(v) => applyPartial({ s: v })} />,
    show("r") && <Knob key="r" label="Release" value={params.r} min={0} max={5} step={0.005} unit="s"  onChange={(v) => applyPartial({ r: v })} />,
  ].filter(Boolean);
  return (
    <>
      {show("scope") && <Canvas tag="Envelope · ADSR (dB)" draw={drawEnv} data={data} />}
      {knobs.length > 0 && (
        <div className={"ctrl-grid" + (knobs.length === 1 ? " one" : "")}>{knobs}</div>
      )}
    </>
  );
}
