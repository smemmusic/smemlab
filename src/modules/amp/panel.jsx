import { useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawMeter } from "../../components/viz/drawMeter.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const DEFAULT_PARAMS = { level: 0 };

export function AmplifierPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.amp;

  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const playing = useSynthStore((s) => s.playing);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  const hist = useRef([]);
  const engine = getEngine();

  // Effective multiplier = 1 + cvLevel/intrinsic. drawMeter computes
  // envDb = linToDb(multiplier) and totalDb = ampDb + envDb, matching the
  // actual audible level. `blocks.amp: true` forces meter render (any rendered
  // amp panel implies an active amp instance); `blocks.env` toggles the
  // "+env" overlay text only when something is actually wired to level.
  const getEffectiveMultiplier = () => {
    const m = engine.getGraph().getModule(id);
    if (!m) return 1;
    const intrinsic = m.node?.gain?.value ?? 1;
    if (intrinsic <= 0) return 1;
    const cv = m.getCvLevel?.("level") ?? 0;
    return 1 + cv / intrinsic;
  };
  const hasCvWired = useSynthStore((s) => s.connections.some((c) => c.toId === id && c.toPort === "level"));
  const data = {
    ampDb: params.level,
    blocks: { amp: true, env: hasCvWired },
    playing,
    getVcaValue: getEffectiveMultiplier,
    hist: hist.current,
  };

  return (
    <>
      <Canvas tag="Output level · dB" screenClass="amber" draw={drawMeter} data={data} />
      <div className="ctrl-grid one">
        <Knob label="Gain" value={params.level} min={-48} max={12} step={0.5} unit="dB" onChange={(v) => setModuleParam(id, "level", v)} />
      </div>
    </>
  );
}
