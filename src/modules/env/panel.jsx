import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawEnv } from "../../components/viz/drawEnv.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = { a: 0.05, d: 0.2, sustainDb: -8, r: 0.4 };

export function EnvelopePanel() {
  const { instanceId: id } = useModuleInstance();

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const playing = useSynthStore((s) => s.playing);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  function applyPartial(partial) {
    for (const [k, v] of Object.entries(partial)) setModuleParam(id, k, v);
  }

  const engine = getEngine();
  // Phase + start read from the engine module directly (updated by onGate).
  const data = {
    env: params, playing,
    get phase() { return engine.getInstanceEnvPhase(id); },
    get start() { return engine.getInstanceEnvStart(id); },
  };

  return (
    <>
      <Canvas tag="Envelope · ADSR (dB)" draw={drawEnv} data={data} />
      <div className="ctrl-grid">
        <Knob label="Attack"  value={params.a}         min={0.005} max={2} step={0.005} unit="s"  onChange={(v) => applyPartial({ a: v })} />
        <Knob label="Decay"   value={params.d}         min={0.005} max={2} step={0.005} unit="s"  onChange={(v) => applyPartial({ d: v })} />
        <Knob label="Sustain" value={params.sustainDb} min={-48}   max={0} step={0.5}   unit="dB" onChange={(v) => applyPartial({ sustainDb: v })} />
        <Knob label="Release" value={params.r}         min={0.005} max={3} step={0.005} unit="s"  onChange={(v) => applyPartial({ r: v })} />
      </div>
    </>
  );
}
