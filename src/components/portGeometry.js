import { PORT_TYPE, PORT_DIR } from "../audio/graph/types.js";

// Single source for where a port sits on its module and what colour it draws.
// Shared by ModulePorts (layout), PortMarker (markers), and Wires (bezier
// tangents + stroke colour) so the placement/colour rules can't drift between
// the three. Layout rule: audio on the horizontal edges (in→left, out→right),
// everything else (CV / pitch / gate) on the vertical edges (out→top, in→bottom).

export function portEdge(port) {
  if (!port) return "right";
  if (port.type === PORT_TYPE.AUDIO) return port.dir === PORT_DIR.IN ? "left" : "right";
  return port.dir === PORT_DIR.OUT ? "top" : "bottom";
}

// Unit outward direction of each edge — the bezier handle leaves a port heading
// this way so the wire emerges perpendicular to the module face.
export const EDGE_TANGENT = {
  right:  [ 1,  0],
  left:   [-1,  0],
  top:    [ 0, -1],
  bottom: [ 0,  1],
};

// Port-type → brand colour token. Audio = ink, CV/pitch = control red,
// gate = rouge. Callers supply their own fallback for unknown types.
export const PORT_COLOR_VAR = {
  [PORT_TYPE.AUDIO]: "var(--audio)",
  [PORT_TYPE.CV]:    "var(--control)",
  [PORT_TYPE.PITCH]: "var(--control)",
  [PORT_TYPE.GATE]:  "var(--gate)",
};
