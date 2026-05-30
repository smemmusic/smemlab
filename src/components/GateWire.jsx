import { useLayoutEffect, useMemo, useState } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { deriveBlocks } from "../modules/_registry.js";

// Routes a gate wire from each source module's bottom to the Envelope
// module's bottom via a bent path that drops below the rack — so wires
// never cross other modules. Renders only in chapter mode (the unified
// <Wires> overlay takes over in free mode). Highlighting is currently
// always-on for any wire whose source module is present + env is present.
// Per-source live highlight is deferred (would need to subscribe to the
// env module's _gateSources, which lives on the runtime instance).
const SOURCES = ["keyboard", "gate"];

export function GateWire({ containerRef }) {
  // Select the modules array (stable reference) and derive blocks via useMemo
  // — selecting `deriveBlocks(s.modules)` directly returns a fresh object on
  // every store read, triggering an infinite re-render loop.
  const modules = useSynthStore((s) => s.modules);
  const blocks  = useMemo(() => deriveBlocks(modules), [modules]);
  const [geom, setGeom] = useState(null);
  const envOn = blocks.env;
  const activeKey = SOURCES.filter((id) => blocks[id] && envOn).join(",");

  useLayoutEffect(() => {
    const stage = containerRef.current;
    if (!stage || !envOn || !activeKey) { setGeom(null); return; }

    function update() {
      const env = stage.querySelector('[data-id="env"]');
      if (!env) { setGeom(null); return; }

      const stageRect = stage.getBoundingClientRect();
      const envRect   = env.getBoundingClientRect();
      const envX = envRect.left + envRect.width / 2 - stageRect.left;
      const envY = envRect.bottom - stageRect.top;

      const sources = [];
      for (const id of SOURCES) {
        if (!blocks[id]) continue;
        const el = stage.querySelector(`[data-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        sources.push({
          id,
          x: r.left + r.width / 2 - stageRect.left,
          y: r.bottom - stageRect.top,
        });
      }
      if (!sources.length) { setGeom(null); return; }

      const drop    = 22;
      const lowestY = Math.max(envY, ...sources.map((s) => s.y)) + drop;
      const r       = 12;

      const paths = sources.map((s) => {
        const goingRight = s.x < envX;
        const sourceTurnX = s.x + (goingRight ?  r : -r);
        const envTurnX    = envX + (goingRight ? -r :  r);
        const d = [
          `M ${s.x} ${s.y}`,
          `V ${lowestY - r}`,
          `Q ${s.x} ${lowestY}, ${sourceTurnX} ${lowestY}`,
          `H ${envTurnX}`,
          `Q ${envX} ${lowestY}, ${envX} ${lowestY - r}`,
          `V ${envY}`,
        ].join(" ");
        return { id: s.id, d, x: s.x, y: s.y };
      });

      setGeom({ paths, env: { x: envX, y: envY } });
    }

    let raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    ro.observe(stage);
    const rack = stage.querySelector(".rack");
    if (rack) ro.observe(rack);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [containerRef, envOn, activeKey, blocks]);

  if (!geom) return null;

  return (
    <svg
      className="gate-wire"
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: "100%", height: "100%",
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 4,
      }}
    >
      {geom.paths.map((p) => (
        <g key={p.id}>
          <path d={p.d} fill="none" stroke="var(--gate)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          <path className="flowg" d={p.d} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={p.x} cy={p.y} r="3.5" fill="var(--gate)" />
        </g>
      ))}
      <circle cx={geom.env.x} cy={geom.env.y} r="3.5" fill="var(--gate)" />
    </svg>
  );
}
