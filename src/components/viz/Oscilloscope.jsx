import { useMemo } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Canvas } from "./Canvas.jsx";
import { drawScope } from "./drawScope.js";
import { VIZ } from "./gridHelpers.js";

// The single oscilloscope screen used by every "scope" panel.
// Pass `analyserName` ("osc" | "out") to pick which tap feeds it; everything
// else (screen kind, glow colour, buffer size, trigger edge & threshold, draw
// function) is fixed here so two scopes can't drift visually.
export function Oscilloscope({ tag, analyserName }) {
  const playing   = useSynthStore((s) => s.playing);
  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const buf       = useMemo(() => new Uint8Array(2048), []);
  const data = {
    analyser: playing ? getEngine().getAnalyser(analyserName) : null,
    buf,
    color: VIZ.AUDIO_COLOR,
    edge,
    threshold
  };
  return <Canvas tag={tag} screenClass="amber" draw={drawScope} data={data} />;
}
