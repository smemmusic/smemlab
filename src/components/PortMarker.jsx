import { useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { PORT_TYPE, PORT_DIR, portsCompatible } from "../audio/graph/types.js";

// Visual port socket. Two ways to patch, both supported at once:
//
//   Drag-to-patch (primary): press an OUTPUT and drag — a live wire follows the
//   cursor (drawn by <Wires>), compatible inputs glow, and the one under the
//   cursor lights as a drop target. Release over it to connect; release on
//   empty space leaves the source armed so you can finish with a click.
//
//   Click-to-patch (fallback, unchanged): click an OUTPUT to arm it, then click
//   a compatible INPUT to connect. A second output click re-arms; an
//   incompatible input click clears the arm.
//
// Stage-level Escape clears the arm. Compatibility uses portsCompatible() —
// type-checked plus the CV → pitch coercion rule.

const TYPE_COLOR_VAR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};

const DRAG_THRESHOLD = 4; // px of movement before a press becomes a drag

export function PortMarker({ moduleId, port }) {
  const armedSource = useSynthStore((s) => s.ui.armedSource);
  const connections = useSynthStore((s) => s.connections);
  const armSource         = useSynthStore((s) => s.armSource);
  const clearArmedSource  = useSynthStore((s) => s.clearArmedSource);
  const connectModules    = useSynthStore((s) => s.connectModules);
  const startDragWire     = useSynthStore((s) => s.startDragWire);
  const updateDragWire    = useSynthStore((s) => s.updateDragWire);
  const endDragWire       = useSynthStore((s) => s.endDragWire);

  // True (only for inputs) when this port is the compatible target currently
  // under a dragged wire. A primitive selector keeps re-renders to just the
  // port that gains/loses the highlight, not every port on every pointermove.
  // Excludes the invalid (duplicate) case — we don't want to invite a release.
  const isDropTarget = useSynthStore((s) =>
    port.dir === PORT_DIR.IN &&
    !!s.ui.dragWire &&
    !s.ui.dragWire.invalid &&
    s.ui.dragWire.hoverId === `${moduleId}:${port.name}`
  );

  // Set true on pointer-up after a real drag so the synthetic click that the
  // browser may still fire on the source output doesn't re-trigger arming.
  const suppressClickRef = useRef(false);

  const isArmed = armedSource
    && armedSource.moduleId === moduleId
    && armedSource.portName === port.name;

  // True when the currently-armed output is already wired into THIS input —
  // we don't want to offer it as a candidate (would create a duplicate
  // connection) or visually invite a click that does nothing useful.
  const alreadyWiredFromArmed = !!(armedSource
    && port.dir === PORT_DIR.IN
    && connections.some((c) =>
        c.fromId   === armedSource.moduleId &&
        c.fromPort === armedSource.portName &&
        c.toId     === moduleId &&
        c.toPort   === port.name));

  // Highlight every other compatible, not-yet-wired input when something is
  // armed, so the user can see where a NEW wire could land.
  let isCandidate = false;
  if (armedSource && !isArmed && port.dir === PORT_DIR.IN && !alreadyWiredFromArmed) {
    const armedPort = { type: armedSource.portType, dir: PORT_DIR.OUT };
    isCandidate = portsCompatible(armedPort, port);
  }

  // Resolve the compatible input under a viewport point, if any. Reads the
  // port metadata straight off the DOM dataset so we don't need a store lookup
  // mid-drag. Returns { moduleId, portName, duplicate } or null.
  // A duplicate target (same source+dest already wired) still resolves so the
  // caller can flag the drag preview as invalid and refuse the drop, instead
  // of silently treating the duplicate as empty space.
  function compatibleInputAt(clientX, clientY) {
    // Walk every element under the cursor (not just the topmost) so a wire
    // passing over a port — the wires overlay sits above the ports layer —
    // doesn't shadow the port we're actually hovering.
    const stack = document.elementsFromPoint
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)];
    let portEl = null;
    for (const el of stack) {
      const p = el && el.closest ? el.closest(".port") : null;
      if (p) { portEl = p; break; }
    }
    if (!portEl || portEl.dataset.portDir !== PORT_DIR.IN) return null;
    const targetPort = { type: portEl.dataset.portType, dir: PORT_DIR.IN };
    const srcPort = { type: port.type, dir: PORT_DIR.OUT };
    if (!portsCompatible(srcPort, targetPort)) return null;
    const toId = portEl.dataset.moduleId;
    const toPort = portEl.dataset.portName;
    const duplicate = connections.some((c) =>
      c.fromId === moduleId && c.fromPort === port.name &&
      c.toId === toId && c.toPort === toPort);
    return { moduleId: toId, portName: toPort, duplicate };
  }

  // Press on an output → maybe-drag. We don't commit to a drag (or arm) until
  // the pointer actually moves past the threshold, so a plain click still falls
  // through to handleClick() and behaves exactly as before.
  function handlePointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (port.dir !== PORT_DIR.OUT) return;
    e.stopPropagation();
    // Clear any stale suppression from a previous drag that ended without a
    // follow-up click (drop on a different port fires no click on the source).
    suppressClickRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function onMove(ev) {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) <= DRAG_THRESHOLD) return;
        dragging = true;
        armSource(moduleId, port.name, port.type);
        startDragWire(moduleId, port.name, port.type, ev.clientX, ev.clientY);
      }
      ev.preventDefault(); // suppress text selection while dragging
      const target = compatibleInputAt(ev.clientX, ev.clientY);
      updateDragWire(
        ev.clientX, ev.clientY,
        target ? `${target.moduleId}:${target.portName}` : null,
        !!(target && target.duplicate),
      );
    }

    function onUp(ev) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!dragging) return; // plain click — handleClick() will arm the source
      suppressClickRef.current = true;
      const target = compatibleInputAt(ev.clientX, ev.clientY);
      endDragWire();
      // Refuse the drop when it would duplicate an existing wire — the red
      // preview already told the user this isn't allowed. Treat it like a
      // drop on empty space (source stays armed).
      if (target && !target.duplicate) {
        connectModules(moduleId, port.name, target.moduleId, target.portName);
        clearArmedSource();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleClick(e) {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (port.dir === PORT_DIR.OUT) {
      // Clicking an output (re)arms regardless of whether something else is armed.
      armSource(moduleId, port.name, port.type);
      return;
    }
    // Clicking an input.
    if (!armedSource) return;  // nothing to wire from
    const armedPort = { type: armedSource.portType, dir: PORT_DIR.OUT };
    if (!portsCompatible(armedPort, port)) {
      clearArmedSource();
      return;
    }
    if (armedSource.moduleId === moduleId && armedSource.portName === port.name) {
      clearArmedSource();
      return;
    }
    // Guard against duplicate connections: clicking an input already wired
    // from the armed source is a no-op (just clears the arm).
    if (alreadyWiredFromArmed) {
      clearArmedSource();
      return;
    }
    connectModules(armedSource.moduleId, armedSource.portName, moduleId, port.name);
    clearArmedSource();
  }

  const color = TYPE_COLOR_VAR[port.type] || "var(--muted)";
  const cls = [
    "port",
    `port-${port.dir}`,
    `port-${port.type}`,
    isArmed && "armed",
    isCandidate && "candidate",
    isDropTarget && "drop-target",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      style={{ "--port-color": color }}
      data-module-id={moduleId}
      data-port-name={port.name}
      data-port-dir={port.dir}
      data-port-type={port.type}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      title={port.description
        ? `${port.name} · ${port.type} ${port.dir} · ${port.description}`
        : `${port.name} · ${port.type} ${port.dir}`}
    >
      <span className="port-dot" aria-hidden="true" />
      <span className="port-label">{port.name}</span>
      {/* Invisible anchor at the OUTER end of the pill (past the label).
          `data-port-id` lives here so <Wires> attaches each endpoint past
          the label, never crossing the label text. The dot stays as the
          visual port marker at the module border. */}
      <span className="port-anchor" data-port-id={`${moduleId}:${port.name}`} aria-hidden="true" />
    </button>
  );
}
