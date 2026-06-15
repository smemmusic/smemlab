import { PortMarker } from "./PortMarker.jsx";
import { listStaticPorts } from "../audio/graph/types.js";
import { byType } from "../modules/_registry.js";
import { usePuzzleModule } from "../content/puzzleHooks.js";
import { portEdge } from "./portGeometry.js";

// Group ports by which edge they sit on (see portGeometry.portEdge): audio on
// the horizontal edges, CV/pitch/gate on the vertical edges. Order within an
// edge is preserved so flex distributes them evenly.
function layoutPorts(ports) {
  const groups = { left: [], right: [], top: [], bottom: [] };
  for (const p of ports) groups[portEdge(p)].push(p);
  return groups;
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
// How deep the snapped overlap is on each axis. The auto-snap places adjacent
// modules so their port-anchors coincide; setting the anchor N pixels inside
// the module from the far edge pulls the neighbor N pixels into this module
// for a visible interlock.
//   - Horizontal (audio chain): 1 px so the audio-chain modules touch at
//     border lines (just enough to share a single seam line, no visible gap).
//   - Vertical (CV / gate / pitch): 16 px so control modules sit 16 px inside
//     the audio module above them — the puzzle tab visibly embeds into the
//     upper module's body rather than barely brushing its edge.
const PUZZLE_OVERLAP_X = 1;
const PUZZLE_OVERLAP_Y = 16;

// Position style for a port in puzzle mode. Each port is absolutely positioned
// at a fraction along its edge — that fraction is interpreted as a fraction of
// the module's BORDER-BOX so two modules of different widths can have ports at
// matching absolute offsets (e.g. the 3U keyboard's pitch at 1/6 lines up
// exactly with a 1U oscillator's pitch at 1/2). We convert to pixels because
// CSS `%` would resolve against padding-box and lose the border to drift.
function puzzlePortStyle(edge, fraction, w, h) {
  const moduleW = w * PUZZLE_U_W;
  const moduleH = h * PUZZLE_U_H;
  const xPx = fraction * moduleW - PUZZLE_BORDER;
  const yPx = fraction * moduleH - PUZZLE_BORDER;
  // The port-anchors live OVERLAP_* px inside the SOURCE module's far edge,
  // so on the TARGET module they live OVERLAP_* px OUTSIDE the near edge —
  // both modules then share the same anchor coordinate at a point that's
  // OVERLAP_* px deep inside the source. When the snap aligns those anchors,
  // the target's frame lands exactly on the source's edge AND its tab SVG
  // (which always draws upward/leftward from the anchor) overlays the
  // source's notch SVG pixel-for-pixel.
  const farEdgeX = moduleW - PUZZLE_BORDER - PUZZLE_OVERLAP_X;
  const farEdgeY = moduleH - PUZZLE_BORDER - PUZZLE_OVERLAP_Y;
  const nearEdgeX = -PUZZLE_BORDER - PUZZLE_OVERLAP_X;
  const nearEdgeY = -PUZZLE_BORDER - PUZZLE_OVERLAP_Y;
  switch (edge) {
    case "right":  return { position: "absolute", left: `${farEdgeX}px`, top:  `${yPx}px` };
    case "left":   return { position: "absolute", left: `${nearEdgeX}px`, top:  `${yPx}px` };
    case "top":    return { position: "absolute", top:  `${nearEdgeY}px`, left: `${xPx}px` };
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
