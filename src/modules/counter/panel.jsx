import { useEffect, useRef, useState } from "react";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

// Live readout of the counter's state. Mirrors the module's `count` per frame
// (rAF, short-circuited when unchanged) and renders it three ways at once:
// the decimal value, two binary LEDs (twos place + ones place), and the raw
// bit string — so the visitor can watch 0/00 → 1/01 → 2/10 → 3/11 → 0/00.
export function CounterPanel() {
  const { instanceId: id } = useModuleInstance();
  const [count, setCount] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const c = m?.count ?? 0;
      setCount((prev) => (prev === c ? prev : c));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  const b1 = (count & 2) !== 0;
  const b0 = (count & 1) !== 0;

  return (
    <div className="counter-body">
      <div className="counter-readout">{count}</div>
      <div className="counter-bits">
        <div className={"counter-bit" + (b1 ? " on" : "")}>
          <span className="counter-led" />
          <span className="counter-bit-label">bit 1</span>
        </div>
        <div className={"counter-bit" + (b0 ? " on" : "")}>
          <span className="counter-led" />
          <span className="counter-bit-label">bit 0</span>
        </div>
      </div>
      <div className="counter-hint">{`${b1 ? 1 : 0}${b0 ? 1 : 0} · binary`}</div>
    </div>
  );
}
