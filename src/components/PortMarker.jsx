import { useSynthStore } from "../store/useSynthStore.js";
import { PORT_TYPE, PORT_DIR, portsCompatible } from "../audio/graph/types.js";

// Visual port socket. Click behavior:
//   - No armed source + click on an OUTPUT  → arm this port as source.
//   - Armed source + click on a compatible INPUT → connect and clear arm.
//   - Armed source + click on an output (any) → reset arm to new source.
//   - Armed source + click on an incompatible input → flash + clear arm.
//
// Stage-level Escape key handling clears the arm without needing a click.
// Compatibility uses portsCompatible() — type-checked plus the CV → pitch
// coercion rule.

const TYPE_COLOR_VAR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};

export function PortMarker({ moduleId, port }) {
  const armedSource = useSynthStore((s) => s.ui.armedSource);
  const connections = useSynthStore((s) => s.connections);
  const armSource         = useSynthStore((s) => s.armSource);
  const clearArmedSource  = useSynthStore((s) => s.clearArmedSource);
  const connectModules    = useSynthStore((s) => s.connectModules);

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

  function handleClick(e) {
    e.stopPropagation();
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
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      style={{ "--port-color": color }}
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
