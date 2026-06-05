import { useEffect, useRef, useState } from "react";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

// Live readout of which input the address currently selects. Mirrors the
// module's `index` per frame and lights the matching lamp 1–4, so the visitor
// can see the address (driven by the counter's two bits) pick one of four.
export function MultiplexerPanel() {
  const { instanceId: id } = useModuleInstance();
  const [index, setIndex] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const i = m?.index ?? 0;
      setIndex((prev) => (prev === i ? prev : i));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  return (
    <div className="mux-body">
      <div className="mux-steps">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={"mux-step" + (i === index ? " on" : "")}>
            <span className="mux-led" />
            <span className="mux-step-label">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="mux-hint">{`input ${index + 1} → out`}</div>
    </div>
  );
}
