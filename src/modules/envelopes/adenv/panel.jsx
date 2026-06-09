import { useSynthStore } from "../../../store/useSynthStore.js";
import { getEngine } from "../../../audio/engineSingleton.js";
import { Knob } from "../../../components/controls/Knob.jsx";
import { Canvas } from "../../../components/viz/Canvas.jsx";
import { drawAdEnv } from "../../../components/viz/drawAdEnv.js";
import { useModuleInstance } from "../../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = { a: 0.005, d: 0.4 };

export function AdEnvelopePanel() {
  const { instanceId: id } = useModuleInstance();

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const playing = useSynthStore((s) => s.playing);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  function applyPartial(partial) {
    for (const [k, v] of Object.entries(partial)) setModuleParam(id, k, v);
  }

  const engine = getEngine();
  const data = {
    env: params,
    playing,
    get phase() { return engine.getInstanceEnvPhase(id); },
    get start() { return engine.getInstanceEnvStart(id); },
  };

  return (
    <>
      <Canvas tag="Envelope · AD (dB)" draw={drawAdEnv} data={data} />
      <div className="ctrl-grid">
        <Knob label="Attack" value={params.a} min={0} max={2} step={0.005} unit="s" onChange={(v) => applyPartial({ a: v })} />
        <Knob label="Decay"  value={params.d} min={0} max={4} step={0.005} unit="s" onChange={(v) => applyPartial({ d: v })} />
      </div>
    </>
  );
}
