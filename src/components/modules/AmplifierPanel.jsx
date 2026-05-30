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

  const data = {
    ampDb: params.db,
    blocks,
    playing,
    // VCA meter only reads the canonical env VCA — free-mode amps have no meter source.
    getVcaValue: () => engine.getVcaValue(),
    hist: hist.current
  };

  return (
    <>
      {isCanonical && <Canvas tag="Output level · dB" screenClass="amber" draw={drawMeter} data={data} />}
      <div className="ctrl-grid one">
        <Knob label="Gain" value={params.db} min={-48} max={12} step={0.5} unit="dB" onChange={applyDb} />
      </div>
    </>
  );
}
