import { useEffect } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { getEngine } from "../audio/engineSingleton.js";

// Bridge: store ↔ GraphEngine. Subscribes to the store's `modules` and
// `connections` arrays and diffs them against the live engine state, calling
// addModule / removeModule / setParam / addConnection / removeConnection.
//
// Module/connection creation happens on demand — the engine only adds a
// module once its AudioContext has been created via getEngine().start().
// Until then we accumulate the desired state and replay it on first start.

let _wired = false;

// Shallow diff between two arrays of {id, ...}. Returns added, removed,
// changed (where changed means the same id is present in both but the
// content differs).
function diffById(prev, cur, equalsFn = (a, b) => a === b) {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const curMap  = new Map(cur.map((x) => [x.id, x]));
  const added   = [];
  const removed = [];
  const changed = [];
  for (const [id, x] of curMap) {
    if (!prevMap.has(id)) added.push(x);
    else if (!equalsFn(prevMap.get(id), x)) changed.push({ prev: prevMap.get(id), cur: x });
  }
  for (const [id, x] of prevMap) if (!curMap.has(id)) removed.push(x);
  return { added, removed, changed };
}

function modulesEqual(a, b) {
  if (a.type !== b.type) return false;
  return paramsEqual(a.params, b.params);
}
function paramsEqual(a, b) {
  const ak = Object.keys(a || {}), bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!Object.is(a[k], b[k])) return false;
  return true;
}
function connectionEqual(a, b) {
  return a.fromId === b.fromId && a.fromPort === b.fromPort && a.toId === b.toId && a.toPort === b.toPort;
}

export function useAudioEngineBridge() {
  const engine = getEngine();

  useEffect(() => {
    if (_wired) return;
    _wired = true;

    const sub  = useSynthStore.subscribe;
    const get  = useSynthStore.getState;
    const graph = engine.getGraph();

    // Switch-CV quantisation: when a wired CV source crosses a quantisation
    // boundary on a discrete switch input (osc.type, filter.mode, lfo.shape),
    // the engine fires this callback. We forward through setModuleParam so
    // the store update flows back through reconcile() to actually apply the
    // new value on the audio side, and panels re-render with the new value.
    const setModuleParam = useSynthStore.getState().setModuleParam;
    graph.setSwitchChangeHandler((moduleId, switchName, value) => {
      setModuleParam(moduleId, switchName, value);
    });

    // Bridge memory: the last-pushed params per module id. Only deltas hit the
    // engine, so live values written outside the store (keyboard pitch via
    // facade.setOscFreqLive) survive unrelated store updates.
    const lastParams = new Map();   // id → { ...params }

    function reconcile() {
      if (!graph.ctx) return;
      const { modules, connections } = get();

      const wantIds = new Set(modules.map((m) => m.id));
      // Remove modules no longer wanted (also drops touching connections).
      for (const m of graph.listModules()) {
        if (!wantIds.has(m.id)) {
          graph.removeModule(m.id);
          lastParams.delete(m.id);
        }
      }
      // Add new modules; their initial params come in via the constructor.
      for (const m of modules) {
        if (!graph.getModule(m.id)) {
          try {
            graph.addModule({ id: m.id, type: m.type, params: m.params });
            lastParams.set(m.id, { ...(m.params || {}) });
          } catch (e) { console.warn("[bridge] addModule failed:", m.id, m.type, e); }
        }
      }
      // Push only the params that actually changed since the last reconcile.
      for (const m of modules) {
        const live = graph.getModule(m.id);
        if (!live) continue;
        const prev = lastParams.get(m.id) || {};
        const cur  = m.params || {};
        for (const [key, val] of Object.entries(cur)) {
          if (!Object.is(prev[key], val)) {
            try { live.setParam?.(key, val); } catch {}
          }
        }
        lastParams.set(m.id, { ...cur });
      }

      // Connections: diff and apply.
      const liveConnections = graph.listConnections();
      const { added, removed, changed } = diffById(liveConnections, connections, connectionEqual);
      for (const c of removed) graph.removeConnection(c.id);
      for (const c of changed) {
        graph.removeConnection(c.cur.id);
        try { graph.addConnection(c.cur); }
        catch (e) { console.warn("[bridge] addConnection (changed) failed:", c.cur, e); }
      }
      for (const c of added) {
        try { graph.addConnection(c); }
        catch (e) { console.warn("[bridge] addConnection failed:", c, e); }
      }
    }

    reconcile();
    // Apply the persisted visuals state on first wire-up. Re-applied on every
    // play (below) since new modules might have been constructed before the
    // engine knew the current value.
    engine.setVisualsEnabled(get().visualsEnabled);

    // Subscribe to module / connection / playing state changes.
    const unsubs = [
      sub((s) => s.modules,     reconcile, { equalityFn: (a, b) => {
        if (a === b) return true;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!modulesEqual(a[i], b[i])) return false;
        return true;
      } }),
      sub((s) => s.connections, reconcile, { equalityFn: (a, b) => {
        if (a === b) return true;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i].id !== b[i].id || !connectionEqual(a[i], b[i])) return false;
        }
        return true;
      } }),
      // When the engine flips from stopped → running, reconcile pushes
      // everything to the freshly-created context.
      sub((s) => s.playing, (playing) => {
        if (playing) {
          reconcile();
          engine.setVisualsEnabled(get().visualsEnabled);
        }
      }),
      sub((s) => s.visualsEnabled, (enabled) => engine.setVisualsEnabled(enabled)),
    ];

    return () => {
      _wired = false;
      unsubs.forEach((u) => u());
    };
  }, [engine]);

  return engine;
}
