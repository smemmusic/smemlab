import { PortMarker } from "./PortMarker.jsx";
import { PORT_TYPE, PORT_DIR, listStaticPorts } from "../audio/graph/types.js";
import { byType } from "../modules/_registry.js";
import { usePuzzleModule } from "../content/puzzleHooks.js";

// Layout:
//   audio in   → left  edge
//   audio out  → right edge
//   CV/pitch/gate OUT → top edge
//   CV/pitch/gate IN  → bottom edge
// Within an edge, ports are distributed evenly.
function layoutPorts(ports) {
  const left   = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  const right  = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const top    = ports.filter((p) => p.type !== PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const bottom = ports.filter((p) => p.type !== PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  return { left, right, top, bottom };
}

function portEdge(port) {
  if (port.type === PORT_TYPE.AUDIO) return port.dir === PORT_DIR.IN ? "left" : "right";
  return port.dir === PORT_DIR.OUT ? "top" : "bottom";
}

// Unit constants — must match --u-w / --u-h in global.css. Hardcoded here so
// puzzlePortStyle can compute exact pixel offsets without reaching into the
// CSSOM on every port render.
const PUZZLE_U_W = 280;
const PUZZLE_U_H = 240;
// Module border in puzzle mode (matches `.module` border in global.css). We
// account for it explicitly so port-anchor coordinates are exact at the
// module's BORDER-BOX edge rather than the padding-box edge — CSS percentages
// for absolutely-positioned children resolve against the padding-box, and the
// 1 px shift accumulates into sub-pixel misalignment between tabs and notches.
const PUZZLE_BORDER = 1;

// Position style for a port in puzzle mode. Each port is absolutely positioned
// at a fraction along its edge — that fraction is interpreted as a fraction of
// the module's BORDER-BOX so two modules of different widths can have ports at
// matching absolute offsets (e.g. the 3U keyboard's pitch at 1/6 lines up
// exactly with a 1U oscillator's pitch at 1/2). We convert to pixels because
// CSS `%` would resolve against padding-box and lose the border to drift.
//
// Top/left anchors sit at the border-box edge; bottom/right anchors sit ONE
// PIXEL INSIDE the border-box edge. That asymmetry makes the snap pull
// adjacent modules into a 1-pixel overlap so their two 1-pixel borders share
// the same pixel row instead of stacking adjacent and reading as a thicker
// 2-pixel seam between every pair of touching modules.
function puzzlePortStyle(edge, fraction, w, h) {
  const moduleW = w * PUZZLE_U_W;
  const moduleH = h * PUZZLE_U_H;
  const xPx = fraction * moduleW - PUZZLE_BORDER;
  const yPx = fraction * moduleH - PUZZLE_BORDER;
  const farEdgeX = moduleW - PUZZLE_BORDER * 2;
  const farEdgeY = moduleH - PUZZLE_BORDER * 2 - 15;
  switch (edge) {
    case "right":  return { position: "absolute", left: `${farEdgeX}px`, top:  `${yPx}px` };
    case "left":   return { position: "absolute", left: `-${PUZZLE_BORDER}px`, top:  `${yPx}px` };
    case "top":    return { position: "absolute", top:  `-${PUZZLE_BORDER}px`, left: `${xPx}px` };
    case "bottom": return { position: "absolute", top:  `${farEdgeY}px`, left: `${xPx}px` };
    default:       return { position: "absolute" };
  }
}

export function ModulePorts({ moduleId, type }) {
  const manifest = byType(type);
  const puzzle = usePuzzleModule(moduleId);
  if (!manifest) return null;
  // In puzzle mode the journey declares exactly which ports participate;
  // every other port is hidden so the piece's silhouette only shows the
  // tabs/notches that actually connect to neighbours.
  const allPorts = listStaticPorts(manifest.Cls);
  const ports = puzzle
    ? allPorts.filter((p) => puzzle.ports?.includes(p.name))
    : allPorts;

  // Puzzle mode — bypass the flex groups. Each port wraps in its own absolutely
  // positioned div placed at an explicit fraction along its edge. This lets
  // wide modules (e.g. the 3U keyboard) anchor specific ports to specific
  // columns rather than have flex centre them.
  if (puzzle) {
    const w = puzzle.w ?? 1;
    const h = puzzle.h ?? 2;
    const { left, right, top, bottom } = layoutPorts(ports);
    const byEdge = { left, right, top, bottom };
    const positions = puzzle.portPositions || {};
    return (
      <>
        {ports.map((port) => {
          const edge = portEdge(port);
          const sameEdge = byEdge[edge];
          let frac = positions[port.name];
          if (frac === undefined) {
            const idx = sameEdge.indexOf(port);
            // Default: 0.5 for a lone port; otherwise distribute evenly so
            // adjacent ports never collide. (i+1)/(n+1) gives 0.5 for n=1,
            // [1/3, 2/3] for n=2, [1/4, 1/2, 3/4] for n=3, etc.
            frac = sameEdge.length === 1 ? 0.5 : (idx + 1) / (sameEdge.length + 1);
          }
          return (
            <div
              key={port.name}
              className={`puzzle-port-wrap puzzle-port-${port.dir}`}
              style={puzzlePortStyle(edge, frac, w, h)}
            >
              <PortMarker moduleId={moduleId} port={port} />
            </div>
          );
        })}
      </>
    );
  }

  const { left, right, top, bottom } = layoutPorts(ports);
  return (
    <>
      {left.length > 0 && (
        <div className="ports ports-left">
          {left.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
      {right.length > 0 && (
        <div className="ports ports-right">
          {right.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
      {top.length > 0 && (
        <div className="ports ports-top">
          {top.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
      {bottom.length > 0 && (
        <div className="ports ports-bottom">
          {bottom.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
    </>
  );
}
