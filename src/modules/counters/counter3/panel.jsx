import { useEffect, useRef, useState } from "react";
import { getEngine } from "../../../audio/engineSingleton.js";
import { useModuleInstance } from "../../../components/ModuleInstanceContext.js";

// MSB → LSB so the lights read left-to-right like a written binary number.
const BITS = [2, 1, 0];

export function Counter3Panel() {
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

  return (
    <div className="counter-body">
      <div className="counter-readout">{count}</div>
      <div className="counter-bits">
        {BITS.map((b) => {
          const on = (count & (1 << b)) !== 0;
          return (
            <div key={b} className={"counter-bit" + (on ? " on" : "")}>
              <span className="counter-led" />
              <span className="counter-bit-label">bit {b}</span>
            </div>
          );
        })}
      </div>
      <div className="counter-hint">
        {BITS.map((b) => ((count & (1 << b)) !== 0 ? 1 : 0)).join("") + " · binary"}
      </div>
    </div>
  );
}
