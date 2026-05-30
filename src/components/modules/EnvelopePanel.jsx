import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../controls/Knob.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawEnv } from "../viz/drawEnv.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const DEFAULT_PARAMS = { a: 0.05, d: 0.2, sustainDb: -8, r: 0.4 };

export function EnvelopePanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.env;
  const isCanonical = id === CANONICAL_IDS.env;

  const params   = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const playing  = useSynthStore((s) => s.playing);
  const setEnv   = useSynthStore((s) => s.setEnv);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  function applyPartial(partial) {
    if (isCanonical) setEnv(partial);
    else for (const [k, v] of Object.entries(partial)) setModuleParam(id, k, v);
  }

  const engine = getEngine();
  // Phase + start come from the engine module itself (updated by onGate),
  // not the store — so free-mode envelope panels work the same as canonical
  // without needing the legacy setEnvPhase/markEnvStart bookkeeping.
  const data = {
    env: params, playing,
    get phase() { return engine.getInstanceEnvPhase(id); },
    get start() { return engine.getInstanceEnvStart(id); }
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
