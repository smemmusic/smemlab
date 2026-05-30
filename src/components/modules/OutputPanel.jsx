import { useMemo } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Canvas } from "../viz/Canvas.jsx";
import { drawScope } from "../viz/drawScope.js";
import { OUTPUT_TO_SPEAKER } from "../../content/ui.js";

export function OutputPanel() {
  const playing = useSynthStore((s) => s.playing);
  const buf = useMemo(() => new Uint8Array(2048), []);
  const data = { analyser: playing ? getEngine().getAnalyser("out") : null, buf };

  return (
    <>
      <Canvas tag="Oscilloscope · final signal" draw={drawScope} data={data} />
      <div className="spk">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16 8c1.5 1.5 1.5 6.5 0 8" />
          <path d="M19 5c3 3 3 11 0 14" />
        </svg>
        <span>{OUTPUT_TO_SPEAKER}</span>
      </div>
    </>
  );
}
