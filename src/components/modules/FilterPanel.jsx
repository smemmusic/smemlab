import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { Slider } from "../controls/Slider.jsx";
import { Canvas } from "../viz/Canvas.jsx";
import { drawFilter } from "../viz/drawFilter.js";

export function FilterPanel() {
  const flt       = useSynthStore((s) => s.flt);
  const setCutoff = useSynthStore((s) => s.setCutoff);
  const setQ      = useSynthStore((s) => s.setQ);

  const data = { filterNode: getEngine().getFilterNode(), cutoff: flt.cutoff, q: flt.q };

  return (
    <>
      <Canvas tag="Frequency response" draw={drawFilter} data={data} animate={false} deps={[flt.cutoff, flt.q]} />
      <Slider label="Cutoff Frequency" value={flt.cutoff} min={80} max={12000} unit="Hz" log onChange={setCutoff} />
      <Slider label="Resonance"        value={flt.q}      min={0.1} max={18} step={0.1} unit="Q"  onChange={setQ} />
    </>
  );
}
