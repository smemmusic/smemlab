import { useMemo } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Canvas } from "./Canvas.jsx";
import { drawScope } from "./drawScope.js";
import { VIZ } from "./gridHelpers.js";

// Oscilloscope screen. Pass either:
//   - `analyserName` ("osc" | "out") — uses canonical taps (legacy).
//   - `instanceId` — looks up that specific module's analyser, so free-mode
//     oscillators / outputs each get their own scope.
// `instanceId` takes precedence when both are provided.
export function Oscilloscope({ tag, analyserName, instanceId }) {
  const playing   = useSynthStore((s) => s.playing);
  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const buf       = useMemo(() => new Uint8Array(2048), []);
  let analyser = null;
  if (playing) {
    const eng = getEngine();
    analyser = instanceId ? eng.getInstanceAnalyser(instanceId) : eng.getAnalyser(analyserName);
  }
  const data = { analyser, buf, color: VIZ.AUDIO_COLOR, edge, threshold };
  return <Canvas tag={tag} screenClass="amber" draw={drawScope} data={data} />;
}
