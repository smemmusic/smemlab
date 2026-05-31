import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { newId } from "../audio/graph/types.js";
import { byId as journeyById } from "../content/journeys/index.js";

// ---- Helpers ----

function patchModuleParams(modules, id, partial) {
  let changed = false;
  const next = modules.map((m) => {
    if (m.id !== id) return m;
    changed = true;
    return { ...m, params: { ...m.params, ...partial } };
  });
  return changed ? next : modules;
}

function upsertModule(modules, mod) {
  const i = modules.findIndex((m) => m.id === mod.id);
  if (i === -1) return [...modules, mod];
  const next = modules.slice();
  next[i] = mod;
  return next;
}

function removeModuleById(modules, id) {
  return modules.filter((m) => m.id !== id);
}

// Deep-clone for chapter delta application (deltas must not be mutated; the
// user may step backwards then forward and re-apply the same delta).
function cloneDeep(x) {
  return JSON.parse(JSON.stringify(x));
}

// Empty graph used as a safe fallback. Free-build mode opens here.
const EMPTY_GRAPH = { modules: [], connections: [] };

// Pull the master vol from the first output module in `modules`. Falls back
// to a sane default when no output is present (e.g. user deleted it).
function deriveVolFromModules(modules, fallback = 80) {
  const out = modules.find((m) => m.type === "output");
  return out?.params?.vol ?? fallback;
}

// ---- Store ----

export const useSynthStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ===== Graph =====
        modules:     EMPTY_GRAPH.modules,
        connections: EMPTY_GRAPH.connections,

        // ===== UI state =====
        ui: {
          armedSource: null,
          selectedConnectionId: null,
          focusedModuleSlot: null,
          // Current view scale used by Stage for Module drag scale-correction.
          viewScale: 1,
          // Mobile-only tab: 'synth' shows the rack, 'instructions' shows the narrator.
          mobileView: "synth",
        },

        // ===== Top-level params + persisted UI prefs =====
        vol:     80,
        scope:   { edge: "rising", threshold: 0 },
        chapter: 0,
        started: false,
        journeyId: null,
        settingsOpen: false,

        // ===== Transient (not persisted) =====
        playing: false,

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
        setModulePosition: (id, x, y) => set((s) => ({
          modules: s.modules.map((m) =>
            m.id === id ? { ...m, position: { x: Math.max(0, x), y: Math.max(0, y) } } : m
          ),
        })),
        removeModuleInstance: (id) => set((s) => {
          const modules = removeModuleById(s.modules, id);
          // Free-shape graph — drop any connection whose endpoint is gone, but
          // never regenerate connections automatically. The user owns the wiring.
          const connections = s.connections.filter((c) =>
            modules.some((m) => m.id === c.fromId) && modules.some((m) => m.id === c.toId)
          );
          // Keep the transport's master `vol` in sync with whichever output
          // module is still present (or a sane default if none).
          const vol = deriveVolFromModules(modules, s.vol);
          return {
            modules,
            connections,
            vol,
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
        // module.position — i.e. pre-transform of .rack-canvas). They persist
        // with the connection; an undefined/missing array means "straight
        // edge-to-edge curve".
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
        // Apply a journey chapter's `adds` delta to the graph. All operations
        // are idempotent: re-applying after a back-then-forward navigation
        // does not duplicate modules or connections.
        //   delta.modules?           — array of { id, type, params, position } to add (skip if id exists)
        //   delta.connections?       — array of { id, fromId, fromPort, toId, toPort } to add (skip if id exists)
        //   delta.removeConnections? — array of connection ids to remove
        //   delta.setParams?         — { [moduleId]: { ...paramsToMerge } }
        applyChapterDelta: (delta) => set((s) => {
          if (!delta) return {};
          let { modules, connections } = s;

          if (Array.isArray(delta.modules)) {
            for (const m of delta.modules) {
              if (!modules.some((x) => x.id === m.id)) {
                modules = [...modules, cloneDeep(m)];
              }
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

          // Keep the top-level vol mirrored if an output's vol was set.
          const vol = deriveVolFromModules(modules, s.vol);

          return { modules, connections, vol };
        }),

        // ---- Free-mode UI actions ----
        armSource:         (moduleId, portName, portType) => set((s) => ({
          ui: { ...s.ui, armedSource: { moduleId, portName, portType } }
        })),
        clearArmedSource:  () => set((s) => ({ ui: { ...s.ui, armedSource: null } })),
        selectConnection:  (id) => set((s) => ({ ui: { ...s.ui, selectedConnectionId: id } })),
        clearSelection:    () => set((s) => ({ ui: { ...s.ui, selectedConnectionId: null } })),
        focusModule:       (slot) => set((s) => ({ ui: { ...s.ui, focusedModuleSlot: slot } })),
        clearFocus:        () => set((s) => ({ ui: { ...s.ui, focusedModuleSlot: null } })),
        setViewScale:      (viewScale) => set((s) =>
          s.ui.viewScale === viewScale ? {} : { ui: { ...s.ui, viewScale } }
        ),
        setMobileView:     (mobileView) => set((s) =>
          s.ui.mobileView === mobileView ? {} : { ui: { ...s.ui, mobileView } }
        ),

        // ---- Top-level setters ----
        setVol: (vol) => set((s) => ({
          vol,
          // Sync any output modules' vol param so the engine actually changes.
          modules: s.modules.map((m) =>
            m.type === "output" ? { ...m, params: { ...m.params, vol } } : m
          ),
        })),
        setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
        setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
        setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),
        setPlaying:        (playing) => set({ playing }),

        // ---- Chapters ----
        goChapter:   (i) => set({ chapter: i }),
        nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),

        // ---- Landing / Journey selection ----
        setStarted: (started) => set({ started }),

        // Pick a journey from the landing picker. Loads the journey's own
        // initialPatch (modules + connections) so each journey can begin from
        // an arbitrary patch shape, not just osc→output.
        startJourney: (id) => {
          const journey = journeyById(id);
          const patch = journey?.initialPatch || EMPTY_GRAPH;
          const modules     = cloneDeep(patch.modules || []);
          const connections = cloneDeep(patch.connections || []);
          set({
            modules, connections,
            vol: deriveVolFromModules(modules, 80),
            ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "instructions" },
            chapter: 0,
            journeyId: id,
            started: true,
          });
        },

        // Open free build — empty rack, palette visible. No journey, so no
        // narrator sidebar; the user patches from scratch.
        enterFreeBuild: () => set({
          modules: [], connections: [],
          vol: 80,
          ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
          chapter: 0,
          journeyId: null,
          started: true,
        }),

        // Return to the journey picker. Full reset.
        backToJourneys: () => set({
          modules: [], connections: [],
          vol: 80,
          ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
          chapter: 0,
          journeyId: null,
          started: false,
          playing: false,
        }),

        // "Start again" — re-runs the current journey's initialPatch from
        // chapter 0. In free build, just clears the rack.
        resetSession: () => set((s) => {
          if (s.journeyId) {
            const journey = journeyById(s.journeyId);
            const patch = journey?.initialPatch || EMPTY_GRAPH;
            const modules     = cloneDeep(patch.modules || []);
            const connections = cloneDeep(patch.connections || []);
            return {
              modules, connections,
              vol: deriveVolFromModules(modules, 80),
              ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null },
              chapter: 0,
            };
          }
          return {
            modules: [], connections: [],
            vol: 80,
            ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null },
            chapter: 0,
          };
        }),
      }),
      {
        name: "smem-v1",
        version: 14,
        partialize: (s) => ({
          modules: s.modules,
          connections: s.connections,
          ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
          vol: s.vol,
          scope: s.scope,
          chapter: s.chapter,
          started: s.started,
          journeyId: s.journeyId,
        }),
        // v14: removed canonical/free-mode split. Anything from before this
        // point may have canonical "_"-prefixed ids that no longer match
        // current journey content, so we wipe progress and send the visitor
        // back to the landing picker.
        migrate: (persisted, version) => {
          if (!persisted) return persisted;
          if (version < 14) {
            return {
              modules: [],
              connections: [],
              vol: 80,
              scope: persisted.scope || { edge: "rising", threshold: 0 },
              chapter: 0,
              started: false,
              journeyId: null,
              ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
            };
          }
          return persisted;
        },
        merge: (persisted, current) => ({
          ...current,
          ...persisted,
          scope:       { ...current.scope, ...(persisted?.scope || {}) },
          ui:          { ...current.ui,    ...(persisted?.ui    || {}) },
          modules:     persisted?.modules     || current.modules,
          connections: persisted?.connections || current.connections,
        }),
      }
    )
  )
);
