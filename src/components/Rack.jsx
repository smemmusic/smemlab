import { useLayoutEffect, useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { byType } from "../modules/_registry.js";
import { usePuzzleConfig } from "../content/puzzleHooks.js";

// The rack: absolute-positioned canvas holding every module. Each module's
// position lives on its `position` field in the store; dragging updates it.
//
// In puzzle mode we own the layout: an auto-snap pass measures the DOM after
// each render and repositions every module so that its connected ports land
// on top of the corresponding port on its neighbour. The journey only seeds
// the anchor module's coordinate — every other position is derived.
export function Rack() {
  const modules     = useSynthStore((s) => s.modules);
  const connections = useSynthStore((s) => s.connections);
  const viewScale   = useSynthStore((s) => s.ui.viewScale);
  const setModulePosition = useSynthStore((s) => s.setModulePosition);
  const puzzle = usePuzzleConfig();

  // Refs mirror the store so the ResizeObserver callback (created once below)
  // always sees the latest values without rebinding on every change.
  const modulesRef     = useRef(modules);
  const connectionsRef = useRef(connections);
  const viewScaleRef   = useRef(viewScale);
  const puzzleRef      = useRef(puzzle);
  const setPosRef      = useRef(setModulePosition);
  modulesRef.current     = modules;
  connectionsRef.current = connections;
  viewScaleRef.current   = viewScale;
  puzzleRef.current      = puzzle;
  setPosRef.current      = setModulePosition;

  const rackRef = useRef(null);

  // Synchronous snap pass — runs in `useLayoutEffect` BEFORE the browser
  // paints, so the first frame the user sees is already aligned. CSS-driven
  // module dimensions (`--mod-h`, `--mod-w`) and port positions (flex-laid
  // out from those dimensions) are stable at this point, so measurement
  // gives correct port offsets within each module.
  //
  // This catches every state change that re-renders Rack: chapter deltas,
  // zoom/pan, viewScale updates, etc.
  useLayoutEffect(() => {
    if (!puzzle) return;
    runSnapPass({
      modules,
      connections,
      puzzle,
      viewScale,
      setModulePosition,
    });
  });

  // Observer-driven re-snap. Some panel content (Canvas analyser tap, etc.)
  // sizes itself in a child useEffect after paint, which can shift a module's
  // height or port layout. Without this, those late layout shifts would leave
  // the puzzle pieces visually unaligned until a zoom/pan re-triggered the
  // snap. Re-attaches when modules are added or removed.
  useLayoutEffect(() => {
    if (!puzzle) return;
    const rackEl = rackRef.current;
    if (!rackEl || typeof ResizeObserver === "undefined") return;

    let pending = false;
    const ro = new ResizeObserver(() => {
      // Coalesce bursts of resize events into a single snap pass on the next
      // microtask. The pass itself is synchronous against the current DOM —
      // no rAF needed because we read positions, write store, and let React
      // re-render before the next paint.
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        runSnapPass({
          modules:     modulesRef.current,
          connections: connectionsRef.current,
          puzzle:      puzzleRef.current,
          viewScale:   viewScaleRef.current,
          setModulePosition: setPosRef.current,
        });
      });
    });
    for (const m of modulesRef.current) {
      const el = rackEl.querySelector(`[data-instance-id="${m.id}"]`);
      if (el) ro.observe(el);
    }
    return () => ro.disconnect();
  }, [puzzle, modules.length]);

  return (
    <div ref={rackRef} className={"rack-canvas" + (puzzle ? " puzzle" : "")}>
      {modules.map((m) => {
        const manifest = byType(m.type);
        if (!manifest) return null;
        const Panel = manifest.Panel;
        return (
          <Module key={m.id} type={m.type} instanceId={m.id}>
            <Panel />
          </Module>
        );
      })}
    </div>
  );
}

// Measure + reposition. Pure on the inputs (other than the store write at the
// end), so it can be called from either the layout effect or the observer.
// The 0.5 px threshold prevents float drift from re-firing the write loop
// once the layout has settled.
function runSnapPass({ modules, connections, puzzle, viewScale, setModulePosition }) {
  const targets = layoutPuzzle({ modules, connections, puzzle, viewScale });
  for (const [id, pos] of Object.entries(targets)) {
    const mod = modules.find((m) => m.id === id);
    if (!mod) continue;
    const cur = mod.position || { x: 0, y: 0 };
    if (Math.abs(cur.x - pos.x) > 0.5 || Math.abs(cur.y - pos.y) > 0.5) {
      setModulePosition(id, pos.x, pos.y);
    }
  }
}

// BFS from the puzzle's anchor module. For each connection (treated as an
// undirected edge for layout purposes), place the unvisited side so that its
// connected port lands at the same coordinate as the already-placed side's
// port. The walk uses real DOM measurements (no hard-coded module sizes), so
// it survives layout shifts caused by hidden controls / variable module heights.
//
// We read the actual rack-canvas transform out of `getComputedStyle` rather
// than trusting `viewScale` from the store. The store's viewScale can lag
// the live CSS transform by one paint: on journey entry from the landing,
// `startJourney` writes `viewScale: 1` synchronously while Stage's auto-fit
// useEffect (which actually applies the transform AND mirrors the scale into
// the store) doesn't fire until after the next paint. If we trusted the
// store value, the first snap would divide by 1 while the DOM was still
// scaled by the previous auto-fit factor, and modules would land at totally
// wrong model coordinates until the next zoom/pan kicked things into sync.
function layoutPuzzle({ modules, connections, puzzle, viewScale }) {
  if (!puzzle || modules.length === 0) return {};
  const liveScale = readActualRackScale() ?? viewScale;

  // Pick the anchor — explicit `puzzle.anchor` first, else first module that
  // actually has an entry, else just the first module.
  const anchorId =
    (puzzle.anchor && modules.some((m) => m.id === puzzle.anchor) && puzzle.anchor) ||
    modules.find((m) => puzzle.modules?.[m.id])?.id ||
    modules[0].id;
  const anchorMod = modules.find((m) => m.id === anchorId);
  if (!anchorMod) return {};

  const positions = {
    [anchorId]: anchorMod.position ? { ...anchorMod.position } : { x: 100, y: 100 },
  };

  // Undirected adjacency: each edge contributes both directions so the BFS
  // can walk back along an upstream wire as well as forward.
  const adj = new Map();
  for (const m of modules) adj.set(m.id, []);
  for (const c of connections) {
    if (adj.has(c.fromId)) adj.get(c.fromId).push({ other: c.toId,   ourPort: c.fromPort, theirPort: c.toPort });
    if (adj.has(c.toId))   adj.get(c.toId).push({ other: c.fromId, ourPort: c.toPort,   theirPort: c.fromPort });
  }

  const visited = new Set([anchorId]);
  const queue = [anchorId];
  while (queue.length) {
    const id = queue.shift();
    const myPos = positions[id];
    for (const { other, ourPort, theirPort } of adj.get(id) || []) {
      if (visited.has(other)) continue;
      const myOffset    = portOffsetWithinModule(id,    ourPort,   liveScale);
      const theirOffset = portOffsetWithinModule(other, theirPort, liveScale);
      if (!myOffset || !theirOffset) continue;
      // Snap math: place `other` so other.position + theirOffset == myPos + myOffset
      // (i.e. both port-anchor centres land at the same screen point, which
      // is what makes the tab visually plug into the notch).
      positions[other] = {
        x: myPos.x + myOffset.x - theirOffset.x,
        y: myPos.y + myOffset.y - theirOffset.y,
      };
      visited.add(other);
      queue.push(other);
    }
  }

  return positions;
}

// Reads the live X scale factor off `.rack-canvas`'s computed `transform`
// matrix. Returns `null` when there is no transform (so the caller can fall
// back to the store's viewScale). The first matrix entry of a 2D matrix
// transform is the x-scale.
function readActualRackScale() {
  const rackEl = document.querySelector(".rack-canvas");
  if (!rackEl) return null;
  const cs = getComputedStyle(rackEl);
  const t = cs.transform;
  if (!t || t === "none") return 1;
  const m = t.match(/matrix\(\s*([^,]+),/);
  if (!m) return null;
  const sx = parseFloat(m[1]);
  return Number.isFinite(sx) && sx > 0 ? sx : null;
}

// Centre of the named port within its module, in model (pre-transform) coords.
// Returns null if either element is missing — the BFS skips that edge so we
// don't compute against stale rects.
function portOffsetWithinModule(moduleId, portName, viewScale) {
  const moduleEl = document.querySelector(`[data-instance-id="${moduleId}"]`);
  const portEl   = document.querySelector(`[data-port-id="${moduleId}:${portName}"]`);
  if (!moduleEl || !portEl) return null;
  const mr = moduleEl.getBoundingClientRect();
  const pr = portEl.getBoundingClientRect();
  if (mr.width === 0 || mr.height === 0) return null;
  const s = viewScale > 0 ? viewScale : 1;
  return {
    x: (pr.left + pr.width  / 2 - mr.left) / s,
    y: (pr.top  + pr.height / 2 - mr.top)  / s,
  };
}
