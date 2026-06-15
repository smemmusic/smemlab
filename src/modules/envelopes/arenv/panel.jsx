import { useSynthStore } from "../../../store/useSynthStore.js";
import { getEngine } from "../../../audio/engineSingleton.js";
import { Knob } from "../../../components/controls/Knob.jsx";
import { Canvas } from "../../../components/viz/Canvas.jsx";
import { drawEnv } from "../../../components/viz/drawEnv.js";
import { useModuleParams } from "../../../components/ModuleInstanceContext.js";

// drawEnv expects an ADSR data shape; synthesising `d: 0, s: 0`
// degenerates the curve into an AR triangle with a flat top, so we get the
// same visualiser (and live phase dot) without a second draw helper.
export function ArEnvelopePanel() {
  const [params, setParam, id] = useModuleParams();
  const playing = useSynthStore((s) => s.playing);

  function applyPartial(partial) {
    for (const [k, v] of Object.entries(partial)) setParam(k, v);
  }

  const engine = getEngine();
  const data = {
    env: { ...params, d: 0, s: 0 },
    playing,
    get phase() { return engine.getInstanceEnvPhase(id); },
    get start() { return engine.getInstanceEnvStart(id); },
  };

  return (
    <>
      <Canvas tag="Envelope · AR (dB)" draw={drawEnv} data={data} />
      <div className="ctrl-grid">
        <Knob label="Attack"  value={params.a} min={0} max={2} step={0.005} unit="s" onChange={(v) => applyPartial({ a: v })} />
        <Knob label="Release" value={params.r} min={0} max={5} step={0.005} unit="s" onChange={(v) => applyPartial({ r: v })} />
      </div>
    </>
  );
}
