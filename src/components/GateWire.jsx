import { useLayoutEffect, useState } from "react";
import { useSynthStore } from "../store/useSynthStore.js";

// Routes a gate wire from each source module's bottom to the Envelope
// module's bottom via a bent path that drops below the rack — so wires
// never cross other modules. Currently two possible sources: the on-rack
// Keyboard module (column 0) and the on-rack Gate module (column N-1).
//
// Rendered as a sibling of <Rack /> inside <Stage />, position: absolute.
// Paths use viewport-derived coordinates (after the rack's transform), so
// endpoints sit at the modules' visual bottoms regardless of rack scaling.
const SOURCES = ["keyboard", "gate"];

export function GateWire({ containerRef }) {
  const blocks      = useSynthStore((s) => s.blocks);
  // Per-source flags drive per-wire highlighting.
  const gateSources = useSynthStore((s) => s.gateSources);

  const [geom, setGeom] = useState(null);
  const envOn = blocks.env;
  // Comma-string of active sources — changes when the user toggles either.
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

      // Find each present source module, gather its endpoint.
      const sources = [];
      for (const id of SOURCES) {
        if (!blocks[id]) continue;
        const el = stage.querySelector(`[data-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        sources.push({
          id,
          x: r.left + r.width / 2 - stageRect.left,
          y: r.bottom - stageRect.top
        });
      }
      if (!sources.length) { setGeom(null); return; }

      // Common drop level under the lowest endpoint. r = corner radius.
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
          `V ${envY}`
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
        zIndex: 4
      }}
    >
      {/* One static + animated stroke per source path. The `on` class is
          applied to each <g> independently from its own source flag, so
          pressing the keyboard lights only the keyboard wire, etc. */}
      {geom.paths.map((p) => (
        <g key={p.id} className={gateSources[p.id] ? "on" : ""}>
          <path d={p.d} fill="none" stroke="var(--gate)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          <path className="flowg" d={p.d} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={p.x} cy={p.y} r="3.5" fill="var(--gate)" />
        </g>
      ))}
      {/* Single endpoint dot at the envelope — all paths converge here. */}
      <circle cx={geom.env.x} cy={geom.env.y} r="3.5" fill="var(--gate)" />
    </svg>
  );
}
