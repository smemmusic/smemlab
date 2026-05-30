import { useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Slider } from "../controls/Slider.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawMeter } from "../viz/drawMeter.js";

export function AmplifierPanel() {
  const amp      = useSynthStore((s) => s.amp);
  const blocks   = useSynthStore((s) => s.blocks);
  const playing  = useSynthStore((s) => s.playing);
  const setAmpDb = useSynthStore((s) => s.setAmpDb);

  const hist = useRef([]);
  const engine = getEngine();

  const data = {
    ampDb: amp.db,
    blocks,
    playing,
    getVcaValue: () => engine.getVcaValue(),
    hist: hist.current
  };

  return (
    <>
      <Canvas tag="Amplifier · output level (dB)" draw={drawMeter} data={data} />
      <Slider label="Gain" value={amp.db} min={-48} max={12} step={0.5} unit="dB" onChange={setAmpDb} />
    </>
  );
}
