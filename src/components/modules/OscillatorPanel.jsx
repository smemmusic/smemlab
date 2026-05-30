import { useMemo } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Slider } from "../controls/Slider.jsx";
import { Segment } from "../controls/Segment.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawScope } from "../viz/drawScope.js";

const SHAPES = [
  { value: "sine",     label: "Sine" },
  { value: "sawtooth", label: "Saw" },
  { value: "square",   label: "Square" },
  { value: "triangle", label: "Tri" }
];

export function OscillatorPanel() {
  const osc        = useSynthStore((s) => s.osc);
  const playing    = useSynthStore((s) => s.playing);
  const setOscType = useSynthStore((s) => s.setOscType);
  const setOscFreq = useSynthStore((s) => s.setOscFreq);

  // Allocate the analyser sample buffer once. FFT size is 2048 (fixed).
  const buf = useMemo(() => new Uint8Array(2048), []);
  const data = { analyser: playing ? getEngine().getAnalyser("osc") : null, buf };

  return (
    <>
      <Canvas tag="Oscilloscope · raw output" draw={drawScope} data={data} />
      <Segment options={SHAPES} value={osc.type} onChange={setOscType} />
      <Slider label="Pitch" value={osc.freq} min={55} max={880} unit="Hz" log onChange={setOscFreq} />
    </>
  );
}
