import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Slider } from "../controls/Slider.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawEnv } from "../viz/drawEnv.js";

export function EnvelopePanel() {
  const env      = useSynthStore((s) => s.env);
  const playing  = useSynthStore((s) => s.playing);
  const envPhase = useSynthStore((s) => s.envPhase);
  const setEnv   = useSynthStore((s) => s.setEnv);

  const engine = getEngine();
  // envStart lives on the engine for sub-frame precision; pulled via getter each frame.
  const data = {
    env, envPhase, playing,
    get envStart() { return engine.getEnvStart(); }
  };

  return (
    <>
      <Canvas tag="Envelope · ADSR (dB)" draw={drawEnv} data={data} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
        <Slider label="Attack"   value={env.a}         min={0.005} max={2} step={0.005} unit="s"  onChange={(a) => setEnv({ a })} />
        <Slider label="Decay"    value={env.d}         min={0.005} max={2} step={0.005} unit="s"  onChange={(d) => setEnv({ d })} />
        <Slider label="Sustain"  value={env.sustainDb} min={-48}   max={0} step={0.5}   unit="dB" onChange={(sustainDb) => setEnv({ sustainDb })} />
        <Slider label="Release"  value={env.r}         min={0.005} max={3} step={0.005} unit="s"  onChange={(r) => setEnv({ r })} />
      </div>
    </>
  );
}
