// Pure graph operations — no store, no React, no engine. These are the
// building blocks the store slices compose: array helpers, the single-Output
// invariant, chapter-delta application, and the deterministic journey-graph
// rebuild. Keeping them here (rather than inline in the store) makes the graph
// model testable in isolation and keeps each slice focused on actions.

// Empty graph used as a safe fallback. Free-build mode opens here.
export const EMPTY_GRAPH = { modules: [], connections: [] };

// Default position for an auto-inserted Output in Free build — anchored at the
// far right of the work area so newly-added modules from the palette land to
// its left, mirroring the signal-flow direction of the journeys (where Output
// also sits at x=1200, the rightmost column).
export const DEFAULT_OUTPUT_POSITION = { x: 1200, y: 0 };

export function makeDefaultOutput() {
  return {
    id: `output-${Math.random().toString(36).slice(2, 8)}`,
    type: "output",
    params: { vol: 80 },
    position: { ...DEFAULT_OUTPUT_POSITION },
  };
}

// Deep-clone for chapter delta application (deltas must not be mutated; the
// user may step backwards then forward and re-apply the same delta).
export function cloneDeep(x) {
  return JSON.parse(JSON.stringify(x));
}

export function patchModuleParams(modules, id, partial) {
  let changed = false;
  const next = modules.map((m) => {
    if (m.id !== id) return m;
    changed = true;
    return { ...m, params: { ...m.params, ...partial } };
  });
  if (!changed && import.meta.env?.DEV) {
    console.warn(`[store] setParams targeted absent module id "${id}" — no-op`);
  }
  return changed ? next : modules;
}

export function upsertModule(modules, mod) {
  const i = modules.findIndex((m) => m.id === mod.id);
  if (i === -1) return [...modules, mod];
  const next = modules.slice();
  next[i] = mod;
  return next;
}

export function removeModuleById(modules, id) {
  return modules.filter((m) => m.id !== id);
}

// Enforce the "exactly one Output per patch" invariant. If none is present,
// add a fresh one at the default position. If somehow more than one slipped
// in (e.g. legacy persisted state), keep the first and drop the rest along
// with any connections that pointed at them.
export function ensureSingleOutput(modules, connections) {
  const outputs = modules.filter((m) => m.type === "output");
  if (outputs.length === 1) return { modules, connections };
  if (outputs.length === 0) {
    return { modules: [...modules, makeDefaultOutput()], connections };
  }
  const dropIds = new Set(outputs.slice(1).map((m) => m.id));
  const nextModules = modules.filter((m) => !dropIds.has(m.id));
  const nextConnections = connections.filter(
    (c) => !dropIds.has(c.fromId) && !dropIds.has(c.toId)
  );
  return { modules: nextModules, connections: nextConnections };
}

// Master volume is DERIVED, not stored: the single source of truth is the
// output module's `vol` param — what the engine actually reads. Selecting it
// here keeps the Transport slider in sync without a mirrored top-level value
// that has to be re-derived on every graph mutation. Falls back to 80 when no
// output is present (e.g. pre-landing, or the user deleted it).
export function selectVol(s, fallback = 80) {
  const out = s.modules.find((m) => m.type === "output");
  return out?.params?.vol ?? fallback;
}

// Collect the canonical (authored) position for every module a journey defines,
// scanning its initialPatch and every chapter delta (`adds.modules` and
// `adds.setPositions`). Used when a visitor leaves puzzle mode for the full
// modular view: puzzle layout interlocks the pieces (overlapping coordinates),
// so we spread them back out to the journey's spaced-out authored layout
// instead of leaving them stacked.
export function journeyModulePositions(journey) {
  const pos = {};
  if (!journey) return pos;
  for (const m of journey.initialPatch?.modules || []) {
    if (m.position) pos[m.id] = { ...m.position };
  }
  for (const ch of journey.chapters || []) {
    const adds = ch.adds;
    if (!adds) continue;
    for (const m of adds.modules || []) {
      if (m.position) pos[m.id] = { ...m.position };
    }
    if (adds.setPositions) {
      for (const [id, p] of Object.entries(adds.setPositions)) {
        pos[id] = { x: p.x, y: p.y };
      }
    }
  }
  return pos;
}

// Apply a single journey chapter's `adds` delta to a {modules, connections}
// graph and return the new graph. Pure (no store, returns fresh arrays). All
// operations are idempotent: re-applying after a back-then-forward navigation
// does not duplicate modules or connections.
//   delta.modules?           — { id, type, params, position } to add (skip if id exists)
//   delta.removeModules?     — module ids to remove (cascade-removes connections)
//   delta.connections?       — { id, fromId, fromPort, toId, toPort } to add (skip if id exists)
//   delta.removeConnections? — connection ids to remove
//   delta.setParams?         — { [moduleId]: { ...paramsToMerge } }
//   delta.setPositions?      — { [moduleId]: { x, y } } — reposition existing modules
export function applyDelta({ modules, connections }, delta) {
  if (!delta) return { modules, connections };

  if (Array.isArray(delta.modules)) {
    for (const m of delta.modules) {
      if (!modules.some((x) => x.id === m.id)) {
        modules = [...modules, cloneDeep(m)];
      }
    }
  }

  // Drop modules (and any wires that referenced them). Idempotent:
  // re-applying the same delta after a Prev → Next round-trip is a no-op for
  // already-absent ids. Cascade-removes connections so we never persist a
  // dangling endpoint.
  if (Array.isArray(delta.removeModules)) {
    for (const mid of delta.removeModules) {
      if (!modules.some((m) => m.id === mid)) continue;
      modules = modules.filter((m) => m.id !== mid);
      connections = connections.filter((c) => c.fromId !== mid && c.toId !== mid);
    }
  }

  if (Array.isArray(delta.removeConnections)) {
    for (const cid of delta.removeConnections) {
      connections = connections.filter((c) => c.id !== cid);
    }
  }

  if (Array.isArray(delta.connections)) {
    for (const c of delta.connections) {
      if (!connections.some((x) => x.id === c.id)) {
        connections = [...connections, { ...c }];
      }
    }
  }

  if (delta.setParams && typeof delta.setParams === "object") {
    for (const [moduleId, partial] of Object.entries(delta.setParams)) {
      modules = patchModuleParams(modules, moduleId, partial);
    }
  }

  // Repositioning is idempotent like the rest: re-applying the same delta after
  // a Prev → Next round-trip just snaps to the same coords.
  if (delta.setPositions && typeof delta.setPositions === "object") {
    for (const [moduleId, pos] of Object.entries(delta.setPositions)) {
      if (import.meta.env?.DEV && !modules.some((m) => m.id === moduleId)) {
        console.warn(`[store] setPositions targeted absent module id "${moduleId}" — no-op`);
      }
      modules = modules.map((m) => m.id === moduleId
        ? { ...m, position: { x: pos.x, y: pos.y } }
        : m);
    }
  }

  return { modules, connections };
}

// Rebuild a journey's graph deterministically as a pure function of
// (journey, chapter): start from initialPatch, then fold in the `adds` delta of
// every chapter up to and including `chapter`. This is the canonical graph for
// a guided journey at a given step — used both to start/reset a journey and to
// rehydrate persisted state without trusting a possibly-stale graph snapshot
// (see the store's persist `merge`).
export function buildJourneyGraph(journey, chapter = 0) {
  const initial = journey?.initialPatch || EMPTY_GRAPH;
  let g = {
    modules: cloneDeep(initial.modules || []),
    connections: cloneDeep(initial.connections || []),
  };
  const chapters = journey?.chapters || [];
  const last = Math.min(chapter, chapters.length - 1);
  for (let i = 0; i <= last; i++) {
    if (chapters[i]?.adds) g = applyDelta(g, chapters[i].adds);
  }
  return ensureSingleOutput(g.modules, g.connections);
}

// Shared "swap in a fresh graph" state builder used by every action that
// replaces the whole graph (journey start, free build, patch load, reset).
// Takes a {modules, connections} graph, enforces the single-Output invariant,
// and resets the transient interaction fields. Callers spread their own
// journeyId / started / mobileView overrides onto the result.
//   fresh:true  — reset the view too (scale 1, given mobileView). Default.
//   fresh:false — keep the visitor's current zoom + tab (resetSession), only
//                 clearing the interaction fields. Pass the current `ui`.
export function loadGraph({ modules, connections }, { ui = null, mobileView = "synth", fresh = true } = {}) {
  const g = ensureSingleOutput(modules, connections);
  const interaction = { armedSource: null, dragWire: null, selectedConnectionId: null, focusedModuleSlot: null };
  const nextUi = fresh
    ? { ...interaction, viewScale: 1, mobileView }
    : { ...ui, ...interaction };
  return {
    modules: g.modules,
    connections: g.connections,
    ui: nextUi,
    chapter: 0,
    fullModular: false,
  };
}
