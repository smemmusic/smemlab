import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { PORT_TYPE, listStaticPorts } from "../audio/graph/types.js";
import { OscillatorModule } from "../audio/modules/OscillatorModule.js";
import { FilterModule } from "../audio/modules/FilterModule.js";
import { AmplifierModule } from "../audio/modules/AmplifierModule.js";
import { EnvelopeModule } from "../audio/modules/EnvelopeModule.js";
import { LfoModule } from "../audio/modules/LfoModule.js";
import { OutputModule } from "../audio/modules/OutputModule.js";
import { GateModule } from "../audio/modules/GateModule.js";
import { KeyboardModule } from "../audio/modules/KeyboardModule.js";
import { InverterModule } from "../audio/modules/InverterModule.js";

const TYPE_TO_CLASS = {
  oscillator: OscillatorModule,
  filter:     FilterModule,
  amp:        AmplifierModule,
  env:        EnvelopeModule,
  lfo:        LfoModule,
  output:     OutputModule,
  gate:       GateModule,
  keyboard:   KeyboardModule,
  inverter:   InverterModule,
};

function lookupPortType(modules, fromId, fromPort) {
  const m = modules.find((x) => x.id === fromId);
  if (!m) return null;
  const Cls = TYPE_TO_CLASS[m.type];
  if (!Cls) return null;
  const port = listStaticPorts(Cls).find((p) => p.name === fromPort);
  return port?.type || null;
}

// Unified wire overlay. Reads every connection in the store, looks up each
// endpoint's screen position via [data-port-id="<moduleId>:<portName>"]
// querySelector (same pattern as the legacy GateWire), and draws an SVG path.
//
// Active when:
//   - Free mode is on (always renders all connections)
//   - In chapter mode, only renders user-added connections (id NOT starting
//     with "_c_") so the legacy decorative HCable/VCable/GateWire still owns
//     the chapter visual story.

const TYPE_COLOR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};


// Build a smooth bezier between two screen points. Inputs/outputs are roughly
// horizontal in our layout, so a horizontal-handle cubic Bezier looks natural.
function pathBetween(from, to) {
  const dx = Math.abs(to.x - from.x);
  const handle = Math.max(40, dx * 0.45);
  const c1x = from.x + handle;
  const c2x = to.x   - handle;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}

export function Wires({ containerRef }) {
  const connections = useSynthStore((s) => s.connections);
  const modules     = useSynthStore((s) => s.modules);
  const freeMode    = useSynthStore((s) => s.ui.freeMode);
  const selectedId  = useSynthStore((s) => s.ui.selectedConnectionId);
  const selectConnection    = useSynthStore((s) => s.selectConnection);
  const disconnectModules   = useSynthStore((s) => s.disconnectModules);
  const clearSelection      = useSynthStore((s) => s.clearSelection);

  const [paths, setPaths] = useState([]);
  const rafRef = useRef(0);
  const containerRectRef = useRef(null);

  // Only render the user-added connections in chapter mode; render everything
  // (chapter + free) in free mode so the user sees the full patch.
  const visible = freeMode
    ? connections
    : connections.filter((c) => !c.id.startsWith("_c_"));

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
        next.push({
          id: conn.id,
          d: pathBetween(from, to),
          type: lookupPortType(modules, conn.fromId, conn.fromPort) || PORT_TYPE.AUDIO,
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
  }, [visible.length, freeMode, containerRef]);

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
