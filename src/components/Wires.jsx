import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { PORT_TYPE, PORT_DIR, listStaticPorts } from "../audio/graph/types.js";
import { byType } from "../modules/_registry.js";

function lookupPort(modules, moduleId, portName) {
  const m = modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const manifest = byType(m.type);
  if (!manifest) return null;
  return listStaticPorts(manifest.Cls).find((p) => p.name === portName) || null;
}

// Mirrors the placement rule in ModulePorts.jsx — audio sits left/right,
// CV/pitch/gate sit top/bottom — so the bezier handle leaves the port in the
// direction the port actually emerges from the module.
function portEdge(port) {
  if (!port) return "right";
  if (port.type === PORT_TYPE.AUDIO) return port.dir === PORT_DIR.IN ? "left" : "right";
  return port.dir === PORT_DIR.OUT ? "top" : "bottom";
}

const EDGE_TANGENT = {
  right:  [ 1,  0],
  left:   [-1,  0],
  top:    [ 0, -1],
  bottom: [ 0,  1],
};

// Unified wire overlay. Reads every connection in the store, looks up each
// endpoint's screen position via [data-port-id="<moduleId>:<portName>"]
// querySelector, and draws an SVG bezier between them.

const TYPE_COLOR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};


// Build a smooth cubic bezier whose end-tangents point outward from each
// endpoint's edge — so a top-edge CV output leaves vertically up, a right-edge
// audio out leaves horizontally right, etc. Handle length scales with the
// distance between endpoints so the curve looks tight on short hops and
// generous on long ones.
function pathBetween(from, to, fromEdge, toEdge) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const h = Math.max(40, dist * 0.4);
  const [fdx, fdy] = EDGE_TANGENT[fromEdge] || EDGE_TANGENT.right;
  const [tdx, tdy] = EDGE_TANGENT[toEdge]   || EDGE_TANGENT.left;
  const c1x = from.x + h * fdx;
  const c1y = from.y + h * fdy;
  // toTangent points OUT of the destination port; the incoming handle is the
  // mirror of that (the curve approaches the port from outside).
  const c2x = to.x + h * tdx;
  const c2y = to.y + h * tdy;
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

export function Wires({ containerRef }) {
  const connections = useSynthStore((s) => s.connections);
  const modules     = useSynthStore((s) => s.modules);
  const selectedId  = useSynthStore((s) => s.ui.selectedConnectionId);
  const selectConnection    = useSynthStore((s) => s.selectConnection);
  const disconnectModules   = useSynthStore((s) => s.disconnectModules);
  const clearSelection      = useSynthStore((s) => s.clearSelection);

  const [paths, setPaths] = useState([]);
  const rafRef = useRef(0);
  const containerRectRef = useRef(null);

  const visible = connections;

  // Recompute path screen coords. Cheap enough to do on every animation frame
  // while the page is interactive, but we throttle via rAF to avoid stacking.
  useLayoutEffect(() => {
    function measure() {
      const container = containerRef?.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      containerRectRef.current = cRect;

      const next = [];
      for (const conn of visible) {
        const fromEl = document.querySelector(`[data-port-id="${conn.fromId}:${conn.fromPort}"]`);
        const toEl   = document.querySelector(`[data-port-id="${conn.toId}:${conn.toPort}"]`);
        if (!fromEl || !toEl) continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const from = { x: fr.left + fr.width / 2 - cRect.left, y: fr.top + fr.height / 2 - cRect.top };
        const to   = { x: tr.left + tr.width / 2 - cRect.left, y: tr.top + tr.height / 2 - cRect.top };
        const fromPort = lookupPort(modules, conn.fromId, conn.fromPort);
        const toPort   = lookupPort(modules, conn.toId,   conn.toPort);
        next.push({
          id: conn.id,
          d: pathBetween(from, to, portEdge(fromPort), portEdge(toPort)),
          type: fromPort?.type || PORT_TYPE.AUDIO,
          midX: (from.x + to.x) / 2,
          midY: (from.y + to.y) / 2,
        });
      }
      setPaths(next);
    }

    measure();
    function loop() {
      measure();
      rafRef.current = requestAnimationFrame(loop);
    }
    // Continuous rAF — port positions can shift due to free-rack layout, knob
    // hover effects, scale transforms. The cost is small (only a few querySelectors).
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible.length, containerRef]);

  // Escape clears the armed source (handled in Stage), Delete removes the
  // selected connection.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          disconnectModules(selectedId);
          clearSelection();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, disconnectModules, clearSelection]);

  if (paths.length === 0) return null;

  return (
    <svg className="wires" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4, width: "100%", height: "100%" }}>
      {paths.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <g key={p.id} className={"wire " + (isSelected ? "selected" : "")}>
            {/* Wider invisible hit area for easy clicking */}
            <path
              d={p.d}
              stroke="transparent"
              strokeWidth="14"
              fill="none"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); selectConnection(p.id); }}
            />
            <path
              d={p.d}
              stroke={TYPE_COLOR[p.type] || "var(--audio)"}
              strokeWidth={isSelected ? 3 : 2}
              fill="none"
              opacity={isSelected ? 1 : 0.85}
              style={{ filter: isSelected ? "drop-shadow(0 0 6px currentColor)" : undefined }}
            />
            {isSelected && (
              <g
                transform={`translate(${p.midX}, ${p.midY})`}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onClick={(e) => { e.stopPropagation(); disconnectModules(p.id); clearSelection(); }}
              >
                <circle r="9" fill="rgba(20,26,30,0.95)" stroke="var(--ink)" strokeWidth="1.5" />
                <line x1="-4" y1="-4" x2="4" y2="4" stroke="var(--ink)" strokeWidth="1.5" />
                <line x1="-4" y1="4" x2="4" y2="-4" stroke="var(--ink)" strokeWidth="1.5" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
