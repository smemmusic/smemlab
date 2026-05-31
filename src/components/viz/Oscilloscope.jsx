import { useMemo } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Canvas } from "./Canvas.jsx";
import { drawScope } from "./drawScope.js";
import { VIZ } from "./gridHelpers.js";

// Oscilloscope screen. `instanceId` selects which module's analyser to read
// (oscillators expose `.tap`; outputs expose `getAnalyser()`).
export function Oscilloscope({ tag, instanceId }) {
  const playing   = useSynthStore((s) => s.playing);
  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const buf       = useMemo(() => new Uint8Array(2048), []);
  const analyser  = playing && instanceId ? getEngine().getInstanceAnalyser(instanceId) : null;
  const data = { analyser, buf, color: VIZ.AUDIO_COLOR, edge, threshold };
  return <Canvas tag={tag} screenClass="amber" draw={drawScope} data={data} />;
}
