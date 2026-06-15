import { useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { dbToLin } from "../../audio/constants.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { Canvas } from "../../components/viz/Canvas.jsx";
import { drawMeter } from "../../components/viz/drawMeter.js";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../content/puzzleHooks.js";

export function AmplifierPanel() {
  const [params, setParam, id] = useModuleParams();
  const show = usePuzzleShow(id);

  const playing = useSynthStore((s) => s.playing);

  const hist = useRef([]);
  const engine = getEngine();

  // drawMeter wants the linear multiplier of the CV's contribution; it derives
  // envDb = linToDb(multiplier) internally. The module already holds the CV's
  // dB value (cv × CV_MAX_DB), so we just dbToLin it. `blocks.amp: true` forces
  // meter render; `blocks.env` toggles the "+env" overlay only when something
  // is wired to level.
  const getEffectiveMultiplier = () => {
    const m = engine.getGraph().getModule(id);
    if (!m) return 1;
    return dbToLin(m.getCvDb?.() ?? 0);
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
      {show("meter") && <Canvas tag="Output level · dB" screenClass="amber" draw={drawMeter} data={data} />}
      {show("level") && (
        <div className="ctrl-grid one">
          <Knob label="Gain" value={params.level} min={-48} max={12} step={0.5} unit="dB" onChange={(v) => setParam("level", v)} />
        </div>
      )}
    </>
  );
}
