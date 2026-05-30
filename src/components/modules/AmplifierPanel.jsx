import { useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Knob } from "../controls/Knob.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawMeter } from "../viz/drawMeter.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const DEFAULT_PARAMS = { db: 0, active: true };

export function AmplifierPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.amp;
  const isCanonical = id === CANONICAL_IDS.amp;

  const params   = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const blocks   = useSynthStore((s) => s.blocks);
  const playing  = useSynthStore((s) => s.playing);
  const setAmpDb = useSynthStore((s) => s.setAmpDb);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  const applyDb = isCanonical ? setAmpDb : (v) => setModuleParam(id, "db", v);

  const hist = useRef([]);
  const engine = getEngine();

  // drawMeter reads `blocks.amp` as a "this amp is active" flag — free-mode
  // amp panels only render if their instance exists, so force `amp: true`.
  // For the env-contribution overlay text we only show it when CV is actually
  // wired (env-or-anything connected to amp.level → measurable CV).
  //
  // getVcaValue returns the effective gain multiplier above the knob's
  // intrinsic value. With our additive CV-into-gain model:
  //   actual_linear_gain = intrinsic + cvLevel
  //   multiplier         = actual / intrinsic = 1 + cvLevel/intrinsic
  // drawMeter then computes envDb = linToDb(multiplier) and totalDb = ampDb + envDb,
  // which corresponds to the actual dB level audible at the output.
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
    ampDb: params.db,
    blocks: { ...blocks, amp: true, env: hasCvWired },
    playing,
    getVcaValue: getEffectiveMultiplier,
    hist: hist.current
  };

  return (
    <>
      <Canvas tag="Output level · dB" screenClass="amber" draw={drawMeter} data={data} />
      <div className="ctrl-grid one">
        <Knob label="Gain" value={params.db} min={-48} max={12} step={0.5} unit="dB" onChange={applyDb} />
      </div>
    </>
  );
}
