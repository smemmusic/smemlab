import { newId } from "../../audio/graph/types.js";
import {
  EMPTY_GRAPH, upsertModule, removeModuleById, patchModuleParams, applyDelta,
} from "../graphOps.js";

// Graph slice — the patch model itself: the modules + connections arrays and
// the actions that mutate them (instance lifecycle, wiring, waypoints, chapter
// deltas). Session/journey orchestration that *replaces* the whole graph lives
// in the session slice; this slice is the per-element editing surface.
export const createGraphSlice = (set, get) => ({
  modules:     EMPTY_GRAPH.modules,
  connections: EMPTY_GRAPH.connections,

  // ---- Module instance actions ----

  // `fixedId` lets callers (journey loader, chapter delta) choose stable
  // ids; without one we generate a typed id like "oscillator-x4k2".
  addModuleInstance: (type, params = {}, fixedId = null, position = null) => {
    const id = fixedId || `${type}-${Math.random().toString(36).slice(2, 8)}`;
    let pos = position;
    if (!pos) {
      const existing = get().modules.filter((m) => m.position);
      pos = { x: 20 + (existing.length % 6) * 250, y: 20 + Math.floor(existing.length / 6) * 240 };
    }
    const mod = { id, type, params: { ...params }, position: pos };
    set((s) => ({ modules: upsertModule(s.modules, mod) }));
    return id;
  },
  // Sets a module's absolute position in model coords. Callers are expected to
  // clamp if they want to prevent off-rack positions — the store stores
  // whatever it's given. (The drag handler in Module.jsx clamps to >= 0 so
  // users can't lose a module off the top-left; the puzzle-mode auto-snap
  // intentionally allows sub-pixel negative values so its threshold
  // convergence works.)
  setModulePosition: (id, x, y) => set((s) => ({
    modules: s.modules.map((m) =>
      m.id === id ? { ...m, position: { x, y } } : m
    ),
  })),
  removeModuleInstance: (id) => set((s) => {
    const modules = removeModuleById(s.modules, id);
    // Free-shape graph — drop any connection whose endpoint is gone, but never
    // regenerate connections automatically. The user owns the wiring.
    const connections = s.connections.filter((c) =>
      modules.some((m) => m.id === c.fromId) && modules.some((m) => m.id === c.toId)
    );
    return {
      modules,
      connections,
      ui: { ...s.ui, selectedConnectionId: null, armedSource: null },
    };
  }),
  setModuleParam: (id, key, value) => set((s) => ({
    modules: patchModuleParams(s.modules, id, { [key]: value }),
  })),

  // ---- Connection actions ----
  connectModules: (fromId, fromPort, toId, toPort, fixedId = null) => {
    const id = fixedId || newId();
    set((s) => ({
      connections: [...s.connections, { id, fromId, fromPort, toId, toPort }],
    }));
    return id;
  },
  disconnectModules: (id) => set((s) => ({
    connections: s.connections.filter((c) => c.id !== id),
    ui: { ...s.ui, selectedConnectionId: s.ui.selectedConnectionId === id ? null : s.ui.selectedConnectionId },
  })),

  // ---- Wire waypoints ----
  // Waypoints are stored in model coords (the same coord space as
  // module.position — i.e. pre-transform of .rack-canvas). They persist with
  // the connection; an undefined/missing array means "straight edge-to-edge
  // curve".
  addWaypoint: (connectionId, index, point) => set((s) => ({
    connections: s.connections.map((c) => {
      if (c.id !== connectionId) return c;
      const wps = c.waypoints ? c.waypoints.slice() : [];
      const i = Math.max(0, Math.min(wps.length, index));
      wps.splice(i, 0, { x: point.x, y: point.y });
      return { ...c, waypoints: wps };
    }),
  })),
  moveWaypoint: (connectionId, index, point) => set((s) => ({
    connections: s.connections.map((c) => {
      if (c.id !== connectionId) return c;
      if (!c.waypoints || index < 0 || index >= c.waypoints.length) return c;
      const wps = c.waypoints.slice();
      wps[index] = { x: point.x, y: point.y };
      return { ...c, waypoints: wps };
    }),
  })),
  removeWaypoint: (connectionId, index) => set((s) => ({
    connections: s.connections.map((c) => {
      if (c.id !== connectionId) return c;
      if (!c.waypoints || index < 0 || index >= c.waypoints.length) return c;
      const wps = c.waypoints.filter((_, i) => i !== index);
      const next = { ...c };
      if (wps.length) next.waypoints = wps;
      else            delete next.waypoints;
      return next;
    }),
  })),

  // ---- Chapter delta ----
  // Apply a journey chapter's `adds` delta to the live graph. Idempotent — see
  // applyDelta in graphOps. The same pure function rebuilds the whole journey
  // graph on rehydrate, so the interactive Next button and a cold reload always
  // converge on the same graph for a given (journey, chapter).
  applyChapterDelta: (delta) => set((s) => applyDelta(s, delta)),
});
