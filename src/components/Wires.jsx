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

const TYPE_COLOR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};

// Brand collapses the palette to Red (audio) + Rouge (control) + Red (gate).
// To keep the audio/gate distinction without leaving the palette, gate wires
// render dashed — mirroring the brand's patch library "cross" motif where
// the secondary line is dashed Ink while the primary is solid Red.
const TYPE_DASH = {
  [PORT_TYPE.GATE]: "8 6",
};

// Build a smooth cubic-Bezier polyline through `points` (a list of {x, y}
// screen coords). End-tangents follow each endpoint's edge so the curve leaves
// each port in the physical direction the port emerges from the module.
// Interior waypoint tangents are the bisector of their neighbours — this gives
// C1 continuity (no kinks) without needing a full spline solver.
function buildPath(points, fromEdge, toEdge) {
  if (points.length < 2) return "";
  const n = points.length;
  const tangents = points.map((_, i) => {
    if (i === 0) {
      const [tx, ty] = EDGE_TANGENT[fromEdge] || EDGE_TANGENT.right;
      return { x: tx, y: ty };
    }
    if (i === n - 1) {
      // Flow direction AT the destination = -edge-tangent (curve comes IN).
      const [tx, ty] = EDGE_TANGENT[toEdge] || EDGE_TANGENT.left;
      return { x: -tx, y: -ty };
    }
    const dx = points[i + 1].x - points[i - 1].x;
    const dy = points[i + 1].y - points[i - 1].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  });
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    // Handle length caps at 45% of the segment so c1 and c2 can never cross
    // when both tangents are parallel to the segment — without the cap, a
    // short endpoint-to-endpoint wire (e.g. two ports facing each other
    // through a small gutter) loops back on itself and visually re-crosses
    // the labels we just moved out of its way.
    const h = Math.min(Math.max(segLen * 0.35, 12), segLen * 0.45, 140);
    const c1x = p0.x + tangents[i].x * h;
    const c1y = p0.y + tangents[i].y * h;
    const c2x = p1.x - tangents[i + 1].x * h;
    const c2y = p1.y - tangents[i + 1].y * h;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

// Pick the insert-index when the user double-clicks the wire to add a
// waypoint. `points = [from, ...waypoints, to]`; we find the segment whose
// midpoint is closest to the click and insert at that segment's boundary so
// the new waypoint slots between its neighbours in path order.
function nearestSegmentIndex(points, x, y) {
  let bestI = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    const d = Math.hypot(mx - x, my - y);
    if (d < bestDist) { bestDist = d; bestI = i; }
  }
  return bestI;
}

// Unified wire overlay. Reads every connection in the store, looks up each
// endpoint's screen position via [data-port-id="<moduleId>:<portName>"]
// querySelector, and draws an SVG bezier between them.
export function Wires({ containerRef, panX = 0, panY = 0 }) {
  const connections = useSynthStore((s) => s.connections);
  const modules     = useSynthStore((s) => s.modules);
  const selectedId  = useSynthStore((s) => s.ui.selectedConnectionId);
  const viewScale   = useSynthStore((s) => s.ui.viewScale);
  const dragWire    = useSynthStore((s) => s.ui.dragWire);
  const selectConnection   = useSynthStore((s) => s.selectConnection);
  const disconnectModules  = useSynthStore((s) => s.disconnectModules);
  const clearSelection     = useSynthStore((s) => s.clearSelection);
  const addWaypoint        = useSynthStore((s) => s.addWaypoint);
  const moveWaypoint       = useSynthStore((s) => s.moveWaypoint);
  const removeWaypoint     = useSynthStore((s) => s.removeWaypoint);

  const [paths, setPaths] = useState([]);
  // Live drag-to-patch preview: { d, type, x, y, active } or null. Recomputed
  // by measure() so it shares the same port-position lookup as real wires.
  const [dragPreview, setDragPreview] = useState(null);
  const rafRef = useRef(0);
  const scheduleRef = useRef(() => {});
  // Detached SVG path used only as a calculator for getTotalLength /
  // getPointAtLength — so the disconnect-X lands on the actual curve midpoint,
  // not the straight-line midpoint between endpoints.
  const measurePathRef = useRef(null);
  if (!measurePathRef.current) {
    measurePathRef.current = document.createElementNS("http://www.w3.org/2000/svg", "path");
  }

  // Refs mirror the store so the measure function (created once below) always
  // sees the latest values without needing to re-bind on every store update.
  const connectionsRef = useRef(connections);
  const modulesRef     = useRef(modules);
  const viewScaleRef   = useRef(viewScale);
  const dragWireRef    = useRef(dragWire);
  connectionsRef.current = connections;
  modulesRef.current     = modules;
  viewScaleRef.current   = viewScale;
  dragWireRef.current    = dragWire;

  // Stable measure / schedule setup. Runs once per containerRef change.
  // External resize triggers (window, sidebar collapse, rack-canvas resize)
  // are caught by ResizeObserver; store-driven changes call `schedule()` from
  // the layout effect below.
  useLayoutEffect(() => {
    function measure() {
      rafRef.current = 0;
      // Read container lazily — on some browsers / commit orderings the ref
      // may not have attached at the moment this effect first ran, so we
      // resolve the element on each invocation instead.
      const container = containerRef?.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      // The rack-canvas carries the scale + pan transform. Its post-transform
      // rect is what places model coords on screen: a model point (mx, my)
      // renders at (rRect.left + mx*scale, rRect.top + my*scale).
      const rackEl = container.querySelector(".rack-canvas");
      const rRect  = rackEl ? rackEl.getBoundingClientRect() : null;
      const scale  = viewScaleRef.current;
      const liveConnections = connectionsRef.current;
      const liveModules     = modulesRef.current;

      const next = [];
      for (const conn of liveConnections) {
        const fromEl = document.querySelector(`[data-port-id="${conn.fromId}:${conn.fromPort}"]`);
        const toEl   = document.querySelector(`[data-port-id="${conn.toId}:${conn.toPort}"]`);
        if (!fromEl || !toEl) continue;
        const fr = fromEl.getBoundingClientRect();
        const tr = toEl.getBoundingClientRect();
        const from = { x: fr.left + fr.width / 2 - cRect.left, y: fr.top + fr.height / 2 - cRect.top };
        const to   = { x: tr.left + tr.width / 2 - cRect.left, y: tr.top + tr.height / 2 - cRect.top };
        const fromPort = lookupPort(liveModules, conn.fromId, conn.fromPort);
        const toPort   = lookupPort(liveModules, conn.toId,   conn.toPort);

        // Waypoint screen positions (model coords → container coords).
        const waypoints = (conn.waypoints || []).map((wp) => {
          if (!rRect) return { x: 0, y: 0 };
          return {
            x: rRect.left + wp.x * scale - cRect.left,
            y: rRect.top  + wp.y * scale - cRect.top,
          };
        });

        const points = [from, ...waypoints, to];
        const d = buildPath(points, portEdge(fromPort), portEdge(toPort));

        // Mid-of-curve via the detached measurement path. Fall back to the
        // straight-line midpoint if the browser refuses to measure (very rare).
        let midX = (from.x + to.x) / 2;
        let midY = (from.y + to.y) / 2;
        try {
          measurePathRef.current.setAttribute("d", d);
          const len = measurePathRef.current.getTotalLength();
          if (len > 0) {
            const pt = measurePathRef.current.getPointAtLength(len / 2);
            midX = pt.x;
            midY = pt.y;
          }
        } catch {}

        next.push({
          id: conn.id,
          d,
          points,
          type: fromPort?.type || PORT_TYPE.AUDIO,
          midX,
          midY,
          waypoints,
        });
      }
      setPaths(next);

      // In-flight drag wire: from the source port's anchor to the cursor.
      const dw = dragWireRef.current;
      let preview = null;
      if (dw) {
        const fromEl = document.querySelector(`[data-port-id="${dw.fromId}:${dw.fromPort}"]`);
        if (fromEl) {
          const fr = fromEl.getBoundingClientRect();
          const from = { x: fr.left + fr.width / 2 - cRect.left, y: fr.top + fr.height / 2 - cRect.top };
          const cursor = { x: dw.clientX - cRect.left, y: dw.clientY - cRect.top };
          const fromPort = lookupPort(liveModules, dw.fromId, dw.fromPort);
          // Approach the cursor horizontally from whichever side faces the source.
          const toEdge = cursor.x >= from.x ? "left" : "right";
          preview = {
            d: buildPath([from, cursor], portEdge(fromPort), toEdge),
            type: fromPort?.type || PORT_TYPE.AUDIO,
            x: cursor.x,
            y: cursor.y,
            active: !!dw.hoverId,
            invalid: !!dw.invalid,
          };
        }
      }
      setDragPreview(preview);
    }

    function schedule() {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(measure);
    }
    scheduleRef.current = schedule;

    schedule();

    // Resize triggers: window resize, sidebar collapse, container resize.
    // Observing the container catches its size change; observing the rack
    // catches transform-independent layout shifts of its content. We try
    // immediately and fall back to a single deferred rAF retry — handles the
    // case where the container ref isn't attached yet at effect mount time.
    let ro = null;
    function tryAttachObservers() {
      if (ro) return;
      const container = containerRef?.current;
      if (!container || typeof ResizeObserver === "undefined") return;
      ro = new ResizeObserver(schedule);
      ro.observe(container);
      const rackEl = container.querySelector(".rack-canvas");
      if (rackEl) ro.observe(rackEl);
    }
    tryAttachObservers();
    const retryRaf = ro ? 0 : requestAnimationFrame(tryAttachObservers);

    window.addEventListener("resize", schedule);

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      if (retryRaf) cancelAnimationFrame(retryRaf);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", schedule);
      scheduleRef.current = () => {};
    };
  }, [containerRef]);

  // Store-driven schedule. Every modules/connections/scale change (including
  // mid-drag position updates, which the store fires per pointermove) coalesces
  // into a single rAF before the next paint via scheduleRef. Pan lives in
  // Stage's local state and is passed as a prop — without it here, the wires
  // would not reflow when the user pans the rack.
  useLayoutEffect(() => {
    scheduleRef.current();
  }, [connections, modules, viewScale, panX, panY, dragWire]);

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

  // Convert a screen-space pointer position to model coords (the rack-canvas's
  // pre-transform space, same as module.position + connection.waypoints).
  function screenToModel(clientX, clientY) {
    const container = containerRef?.current;
    if (!container) return null;
    const rackEl = container.querySelector(".rack-canvas");
    if (!rackEl) return null;
    const rRect = rackEl.getBoundingClientRect();
    return {
      x: (clientX - rRect.left) / viewScale,
      y: (clientY - rRect.top)  / viewScale,
    };
  }

  function onPathDoubleClick(e, p) {
    e.stopPropagation();
    const container = containerRef?.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const clickX = e.clientX - cRect.left;
    const clickY = e.clientY - cRect.top;
    const segIdx = nearestSegmentIndex(p.points, clickX, clickY);
    const model = screenToModel(e.clientX, e.clientY);
    if (!model) return;
    addWaypoint(p.id, segIdx, model);
    selectConnection(p.id);
  }

  function onWaypointPointerDown(e, conn, wpIndex) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = connections.find((c) => c.id === conn.id)?.waypoints?.[wpIndex];
    if (!orig) return;
    const scale = viewScale > 0 ? viewScale : 1;
    let didMove = false;
    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) didMove = true;
      if (didMove) {
        moveWaypoint(conn.id, wpIndex, { x: orig.x + dx, y: orig.y + dy });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onWaypointDoubleClick(e, conn, wpIndex) {
    e.stopPropagation();
    removeWaypoint(conn.id, wpIndex);
  }

  if (paths.length === 0 && !dragPreview) return null;

  return (
    <svg className="wires" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4, width: "100%", height: "100%" }}>
      {paths.map((p) => {
        const isSelected = p.id === selectedId;
        const color = TYPE_COLOR[p.type] || "var(--audio)";
        return (
          <g key={p.id} className={"wire " + (isSelected ? "selected" : "")}>
            {/* Wider invisible hit area for easy clicking + dblclick-to-insert-waypoint */}
            <path
              d={p.d}
              stroke="transparent"
              strokeWidth="14"
              fill="none"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); selectConnection(p.id); }}
              onDoubleClick={(e) => onPathDoubleClick(e, p)}
            />
            <path
              d={p.d}
              stroke={color}
              strokeWidth={isSelected ? 3 : 2}
              strokeDasharray={TYPE_DASH[p.type]}
              fill="none"
              opacity={isSelected ? 1 : 0.9}
              style={{ filter: isSelected ? "drop-shadow(0 0 6px currentColor)" : undefined }}
            />
            {isSelected && p.waypoints.map((wp, i) => (
              <circle
                key={i}
                cx={wp.x}
                cy={wp.y}
                r="5.5"
                fill={color}
                stroke="var(--ink)"
                strokeWidth="1.5"
                style={{ pointerEvents: "all", cursor: "grab", filter: "drop-shadow(0 0 4px currentColor)" }}
                onPointerDown={(e) => onWaypointPointerDown(e, { id: p.id }, i)}
                onDoubleClick={(e) => onWaypointDoubleClick(e, { id: p.id }, i)}
              >
                <title>Drag to move · Double-click to remove</title>
              </circle>
            ))}
            {isSelected && (
              <g
                transform={`translate(${p.midX}, ${p.midY})`}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onClick={(e) => { e.stopPropagation(); disconnectModules(p.id); clearSelection(); }}
              >
                <circle r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
                <line x1="-4" y1="-4" x2="4" y2="4" stroke="var(--ink)" strokeWidth="1.5" />
                <line x1="-4" y1="4" x2="4" y2="-4" stroke="var(--ink)" strokeWidth="1.5" />
              </g>
            )}
          </g>
        );
      })}
      {dragPreview && (
        <g
          className={"wire wire-drag" + (dragPreview.invalid ? " wire-drag-invalid" : "")}
          style={{
            color: dragPreview.invalid ? "#ff5252" : (TYPE_COLOR[dragPreview.type] || "var(--audio)"),
            pointerEvents: "none",
          }}
        >
          <path
            d={dragPreview.d}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="7 5"
            fill="none"
            opacity="0.9"
            style={{ filter: "drop-shadow(0 0 5px currentColor)" }}
          />
          <circle
            cx={dragPreview.x}
            cy={dragPreview.y}
            r={dragPreview.active ? 6.5 : 4}
            fill="currentColor"
            opacity="0.95"
            style={{ filter: "drop-shadow(0 0 5px currentColor)" }}
          />
        </g>
      )}
    </svg>
  );
}
