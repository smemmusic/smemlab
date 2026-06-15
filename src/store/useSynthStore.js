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

// Collect the canonical (authored) position for every module a journey
// defines, scanning its initialPatch and every chapter delta (`adds.modules`
// and `adds.setPositions`). Used when a visitor leaves puzzle mode for the
// full modular view: puzzle layout interlocks the pieces (overlapping
// coordinates), so we spread them back out to the journey's spaced-out
// authored layout instead of leaving them stacked.
function journeyModulePositions(journey) {
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

// Default position for an auto-inserted Output in Free build — anchored at
// the far right of the work area so newly-added modules from the palette
// land to its left, mirroring the signal-flow direction of the journeys
// (where Output also sits at x=1200, the rightmost column).
const DEFAULT_OUTPUT_POSITION = { x: 1200, y: 0 };

function makeDefaultOutput() {
  return {
    id: `output-${Math.random().toString(36).slice(2, 8)}`,
    type: "output",
    params: { vol: 80 },
    position: { ...DEFAULT_OUTPUT_POSITION },
  };
}

// Enforce the "exactly one Output per patch" invariant. If none is present,
// add a fresh one at the default position. If somehow more than one slipped
// in (e.g. legacy persisted state), keep the first and drop the rest along
// with any connections that pointed at them.
function ensureSingleOutput(modules, connections) {
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

// Pull the master vol from the first output module in `modules`. Falls back
// to a sane default when no output is present (e.g. user deleted it).
function deriveVolFromModules(modules, fallback = 80) {
  const out = modules.find((m) => m.type === "output");
  return out?.params?.vol ?? fallback;
}

// ---- Patch serialisation ----
// Exported / shared with PatchesModal so it can produce + parse JSON files.

export const PATCH_FILE_FORMAT  = "smemlab-patch";
export const PATCH_FILE_VERSION = 1;

// Wrap a {modules, connections} graph in the on-disk file envelope.
export function serialisePatch(name, patch) {
  return {
    format:    PATCH_FILE_FORMAT,
    version:   PATCH_FILE_VERSION,
    name:      name || "Untitled patch",
    createdAt: Date.now(),
    patch: {
      modules:     cloneDeep(patch.modules),
      connections: cloneDeep(patch.connections),
    },
  };
}

// Module types renamed over time (folder regroups + shared base classes).
// Applied when loading older persisted state and imported patch files so the
// visitor's existing patches keep working. Port names and instance ids are
// unaffected; only the module `type` changes.
const LEGACY_TYPE_RENAMES = {
  env: "adsrenv",          // ADSR envelope joined the shared EnvelopeModule base
  counter: "counter2",     // counters grouped + named for their bit-width
  multiplexer: "mux4",     // muxes grouped + named for their input count
};

function renameLegacyTypes(mods) {
  if (!Array.isArray(mods)) return;
  for (const m of mods) {
    const next = m && LEGACY_TYPE_RENAMES[m.type];
    if (next) m.type = next;
  }
}

// Validate a parsed JSON object and return the inner {modules, connections}
// shape, or null if it doesn't look like a patch file.
export function validatePatchObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.format && obj.format !== PATCH_FILE_FORMAT) return null;
  const p = obj.patch || obj;
  if (!p || !Array.isArray(p.modules) || !Array.isArray(p.connections)) return null;
  for (const m of p.modules) {
    if (!m || typeof m.id !== "string" || typeof m.type !== "string") return null;
  }
  for (const c of p.connections) {
    if (!c || typeof c.id !== "string" ||
        typeof c.fromId !== "string" || typeof c.fromPort !== "string" ||
        typeof c.toId !== "string"   || typeof c.toPort !== "string") return null;
  }
  // Map any renamed module types forward so older exported patches still
  // import (see LEGACY_TYPE_RENAMES).
  const modules = cloneDeep(p.modules);
  renameLegacyTypes(modules);
  return { modules, connections: cloneDeep(p.connections) };
}

// Replace the live graph with a saved patch. Drops journey context so a
// loaded patch doesn't get fought by the chapter delta system.
function applyPatchObject(set, patch) {
  const fixed = ensureSingleOutput(
    cloneDeep(patch.modules),
    cloneDeep(patch.connections),
  );
  set({
    modules: fixed.modules,
    connections: fixed.connections,
    vol: deriveVolFromModules(fixed.modules, 80),
    ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
    chapter: 0,
    journeyId: null,
    fullModular: false,
    started: true,
    patchesOpen: false,
  });
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
          // Live drag-to-patch state. Set while the user is dragging a wire out
          // of an output port; null otherwise. Shape:
          //   { fromId, fromPort, portType, clientX, clientY, hoverId }
          // clientX/clientY track the cursor (viewport coords); hoverId is the
          // "moduleId:portName" of the compatible input currently under the
          // cursor (or null). <Wires> reads this to draw the in-flight wire.
          dragWire: null,
          selectedConnectionId: null,
          focusedModuleSlot: null,
          // Current view scale used by Stage for Module drag scale-correction.
          viewScale: 1,
          // Mobile-only tab: 'synth' shows the rack, 'instructions' shows the narrator.
          mobileView: "synth",
        },

        // ===== Top-level params + persisted UI prefs =====
        vol:     80,
        // Global tempo. Sync-mode clocks derive their rate from this; any future
        // module that needs musical time (sequencer, arpeggiator) reads it from
        // the store directly.
        bpm:     120,
        scope:   { edge: "rising", threshold: 0 },
        // Master visualiser toggle. When false, every Canvas-backed display
        // (oscilloscopes, envelope curves, LFO shapes, gain meters, filter
        // response) skips its analyser reads and rAF loop and renders a
        // static "off" placeholder. Persisted so the visitor's preference
        // survives reload.
        visualsEnabled: true,
        chapter: 0,
        started: false,
        journeyId: null,
        // Puzzle-enabled journeys render as interlocking pieces by default.
        // Flipping this to true drops back to the full modular view (wires,
        // palette, every control + port visible) so an advanced visitor can
        // "go further". Only meaningful while a puzzle journey is active.
        fullModular: false,
        settingsOpen: false,
        patchesOpen: false,

        // ===== Saved patches =====
        // Each entry: { id, name, createdAt, patch: { modules, connections } }.
        // Persists with the rest of the store via the zustand persist middleware.
        savedPatches: [],

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
        // Sets a module's absolute position in model coords. Callers are
        // expected to clamp if they want to prevent off-rack positions —
        // the store stores whatever it's given. (The drag handler in
        // Module.jsx clamps to >= 0 so users can't lose a module off the
        // top-left; the puzzle-mode auto-snap intentionally allows
        // sub-pixel negative values so its threshold convergence works.)
        setModulePosition: (id, x, y) => set((s) => ({
          modules: s.modules.map((m) =>
            m.id === id ? { ...m, position: { x, y } } : m
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
        //   delta.removeModules?     — array of module ids to remove (cascade-removes connections)
        //   delta.connections?       — array of { id, fromId, fromPort, toId, toPort } to add (skip if id exists)
        //   delta.removeConnections? — array of connection ids to remove
        //   delta.setParams?         — { [moduleId]: { ...paramsToMerge } }
        //   delta.setPositions?      — { [moduleId]: { x, y } } — reposition existing modules
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

          // Drop modules (and any wires that referenced them). Idempotent:
          // re-applying the same delta after a Prev → Next round-trip is a
          // no-op for already-absent ids. Cascade-removes connections so
          // we never persist a dangling endpoint.
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

          // Repositioning is idempotent like the rest: re-applying the same
          // delta after a Prev → Next round-trip just snaps to the same coords.
          if (delta.setPositions && typeof delta.setPositions === "object") {
            for (const [moduleId, pos] of Object.entries(delta.setPositions)) {
              modules = modules.map((m) => m.id === moduleId
                ? { ...m, position: { x: pos.x, y: pos.y } }
                : m);
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

        // ---- Drag-to-patch ----
        // Begin dragging a wire out of an output. The armed-source machinery
        // still runs in parallel (so compatible inputs glow as candidates), but
        // these actions feed the live preview wire in <Wires>.
        startDragWire: (fromId, fromPort, portType, clientX, clientY) => set((s) => ({
          ui: { ...s.ui, dragWire: { fromId, fromPort, portType, clientX, clientY, hoverId: null, invalid: false } },
        })),
        updateDragWire: (clientX, clientY, hoverId = null, invalid = false) => set((s) => (
          s.ui.dragWire
            ? { ui: { ...s.ui, dragWire: { ...s.ui.dragWire, clientX, clientY, hoverId, invalid } } }
            : {}
        )),
        endDragWire:    () => set((s) => (s.ui.dragWire ? { ui: { ...s.ui, dragWire: null } } : {})),
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
        setBpm:            (bpm) => set({ bpm: Math.max(20, Math.min(300, Math.round(bpm))) }),
        setVisualsEnabled: (visualsEnabled) => set({ visualsEnabled: !!visualsEnabled }),
        setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
        setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
        setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),
        setPatchesOpen:    (patchesOpen) => set({ patchesOpen }),
        setPlaying:        (playing) => set({ playing }),

        // ---- Patches ----
        // Snapshot the current graph as a named patch. Returns the new patch id.
        savePatch: (name) => {
          const id = newId();
          const patch = {
            modules:     cloneDeep(get().modules),
            connections: cloneDeep(get().connections),
          };
          const entry = { id, name: name || "Untitled patch", createdAt: Date.now(), patch };
          set((s) => ({ savedPatches: [entry, ...s.savedPatches] }));
          return id;
        },
        // Replace the current graph with a saved patch's contents. Drops any
        // journey context (loading a patch puts the visitor in free-build).
        loadPatch: (id) => {
          const entry = get().savedPatches.find((p) => p.id === id);
          if (!entry) return;
          applyPatchObject(set, entry.patch);
        },
        deletePatch: (id) => set((s) => ({
          savedPatches: s.savedPatches.filter((p) => p.id !== id),
        })),
        renamePatch: (id, name) => set((s) => ({
          savedPatches: s.savedPatches.map((p) => p.id === id ? { ...p, name } : p),
        })),
        // Load a patch from an imported JSON object (file upload). The shape
        // must match the export format produced by serialisePatch.
        loadPatchFromObject: (obj) => {
          const patch = validatePatchObject(obj);
          if (!patch) throw new Error("Not a valid patch file");
          applyPatchObject(set, patch);
        },

        // ---- Puzzle ⇄ full modular view ----
        // Toggle a puzzle journey between its interlocking-pieces view and the
        // full modular view. Switching INTO full modular re-spreads the
        // modules to the journey's authored positions (puzzle layout overlaps
        // them); switching back lets Rack's auto-snap re-interlock them.
        setFullModular: (on) => set((s) => {
          const fullModular = !!on;
          if (!fullModular || !s.journeyId) return { fullModular };
          const wanted = journeyModulePositions(journeyById(s.journeyId));
          const modules = s.modules.map((m) =>
            wanted[m.id] ? { ...m, position: { ...wanted[m.id] } } : m
          );
          return { fullModular, modules };
        }),

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
          const fixed = ensureSingleOutput(
            cloneDeep(patch.modules || []),
            cloneDeep(patch.connections || []),
          );
          set({
            modules: fixed.modules,
            connections: fixed.connections,
            vol: deriveVolFromModules(fixed.modules, 80),
            ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "instructions" },
            chapter: 0,
            journeyId: id,
            fullModular: false,
            started: true,
          });
        },

        // Open free build — empty rack with the mandatory Output seeded on
        // the right of the canvas; palette visible. No journey, so no
        // narrator sidebar; the user patches from scratch.
        enterFreeBuild: () => set({
          modules: [makeDefaultOutput()],
          connections: [],
          vol: 80,
          ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
          chapter: 0,
          journeyId: null,
          fullModular: false,
          started: true,
        }),

        // Return to the journey picker. Full reset.
        backToJourneys: () => set({
          modules: [], connections: [],
          vol: 80,
          ui: { armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
          chapter: 0,
          journeyId: null,
          fullModular: false,
          started: false,
          playing: false,
        }),

        // "Start again" — re-runs the current journey's initialPatch from
        // chapter 0. In free build, clears the rack back to a fresh Output.
        resetSession: () => set((s) => {
          if (s.journeyId) {
            const journey = journeyById(s.journeyId);
            const patch = journey?.initialPatch || EMPTY_GRAPH;
            const fixed = ensureSingleOutput(
              cloneDeep(patch.modules || []),
              cloneDeep(patch.connections || []),
            );
            return {
              modules: fixed.modules,
              connections: fixed.connections,
              vol: deriveVolFromModules(fixed.modules, 80),
              ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null },
              chapter: 0,
              fullModular: false,
            };
          }
          return {
            modules: [makeDefaultOutput()],
            connections: [],
            vol: 80,
            ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null },
            chapter: 0,
            fullModular: false,
          };
        }),
      }),
      {
        name: "smem-v1",
        version: 16,
        partialize: (s) => ({
          modules: s.modules,
          connections: s.connections,
          ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
          vol: s.vol,
          bpm: s.bpm,
          scope: s.scope,
          visualsEnabled: s.visualsEnabled,
          chapter: s.chapter,
          started: s.started,
          journeyId: s.journeyId,
          fullModular: s.fullModular,
          savedPatches: s.savedPatches,
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
          if (version < 16) {
            // Module types renamed as several families moved under shared base
            // classes (env→adsrenv, counter→counter2, multiplexer→mux4 — see
            // LEGACY_TYPE_RENAMES). Rename in live modules and every saved patch
            // so existing patches keep loading.
            renameLegacyTypes(persisted.modules);
            for (const p of persisted.savedPatches || []) {
              renameLegacyTypes(p?.patch?.modules);
            }
          }
          return persisted;
        },
        merge: (persisted, current) => {
          const baseModules     = persisted?.modules     || current.modules;
          const baseConnections = persisted?.connections || current.connections;
          // Only seed an Output once the user has actually entered the synth
          // view — pre-landing the rack should stay empty.
          const fixed = persisted?.started
            ? ensureSingleOutput(baseModules, baseConnections)
            : { modules: baseModules, connections: baseConnections };
          // Backfill renamed key: older builds persisted scopesEnabled (gated
          // only the Oscilloscope component); the unified visualsEnabled
          // covers every Canvas now. Pick up the old preference if present.
          const visualsEnabled =
            persisted?.visualsEnabled
            ?? persisted?.scopesEnabled
            ?? current.visualsEnabled;
          return {
            ...current,
            ...persisted,
            scope:       { ...current.scope, ...(persisted?.scope || {}) },
            ui:          { ...current.ui,    ...(persisted?.ui    || {}) },
            modules:     fixed.modules,
            connections: fixed.connections,
            visualsEnabled,
          };
        },
      }
    )
  )
);
