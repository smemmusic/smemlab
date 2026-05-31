import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { BUILTINS, makePreset, packPresetsJSON, parsePresetsJSON, isLegacyConfig } from "./presets.js";
import { buildCanonicalGraph, buildCanonicalConnections } from "./graphBuilder.js";
import { newId } from "../audio/graph/types.js";
import { byCanonical, canonicalList, deriveBlocks } from "../modules/_registry.js";

// Initial graph: derived from the Init preset (already in the new
// { modules, connections } shape after presets.js refactor).
const INITIAL_PRESET = BUILTINS[0].config;
const INITIAL_GRAPH = isLegacyConfig(INITIAL_PRESET)
  ? buildCanonicalGraph(INITIAL_PRESET)
  : { modules: INITIAL_PRESET.modules, connections: INITIAL_PRESET.connections };

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

function removeConnectionsTouching(connections, id) {
  return connections.filter((c) => c.fromId !== id && c.toId !== id);
}

// Recompute the canonical chain after any change to which canonical instances
// exist. Free-mode user-added connections (ids not starting with "_c_") are
// preserved untouched.
function rebuildCanonicalConnections(prevConnections, modules) {
  const userConns = prevConnections.filter((c) => !c.id.startsWith("_c_"));
  return [...buildCanonicalConnections(modules), ...userConns];
}

// ---- Store ----

export const useSynthStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ===== Canonical typed-port graph =====
        modules:     INITIAL_GRAPH.modules,
        connections: INITIAL_GRAPH.connections,

        // ===== UI state =====
        ui: {
          freeMode: false,
          armedSource: null,
          selectedConnectionId: null,
          focusedModuleSlot: null,
          // Current view scale used by Stage to render rack/free-rack via
          // transform: scale(). Exposed in the store so Module drag handlers
          // can divide pointer-delta by this value, keeping the dragged
          // module under the cursor regardless of zoom level.
          viewScale: 1,
        },

        // ===== Top-level params + persisted UI prefs =====
        vol:     42,
        scope:   { edge: "rising", threshold: 0 },
        chapter: 0,
        started: false,
        journeyId: null,
        settingsOpen: false,
        presets: { activeId: "init", user: [] },

        // ===== Transient (not persisted) =====
        playing: false,

        // ---- Module instance actions ----
        addModuleInstance: (type, params = {}, fixedId = null, position = null) => {
          const id = fixedId || newId();
          let pos = position;
          if (!pos && !id.startsWith("_")) {
            const existing = get().modules.filter((m) => !m.id.startsWith("_") && m.position);
            pos = { x: 20 + (existing.length % 6) * 250, y: 20 + Math.floor(existing.length / 6) * 240 };
          }
          const mod = { id, type, params: { ...params }, ...(pos ? { position: pos } : {}) };
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
          // Apply manifest-declared `requires` cascade: any canonical with
          // requires=[<removed-id>, …] drops too. Iterate until fixed point
          // so chains of requirements resolve (rare today but cheap).
          let next = modules;
          let dirty = true;
          while (dirty) {
            dirty = false;
            for (const m of canonicalList()) {
              const req = m.canonical.requires;
              if (!req || !req.length) continue;
              const present = next.some((x) => x.id === m.canonical.id);
              if (!present) continue;
              if (req.every((r) => next.some((x) => x.id === r))) continue;
              next = removeModuleById(next, m.canonical.id);
              dirty = true;
            }
          }
          return {
            modules: next,
            connections: rebuildCanonicalConnections(
              s.connections.filter((c) =>
                next.some((m) => m.id === c.fromId) && next.some((m) => m.id === c.toId)
              ),
              next,
            ),
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

        // ---- Canonical chapter-mode actions ----
        // Add the canonical instance for a canonical id, using the manifest's
        // defaults. Also rebuilds canonical connections (so the audio chain
        // and modulation auto-wires reflect the new module). Chapter cascades
        // (env brings in gate) and side-effects (kb sets osc.freq=440) are
        // declared inline here for clarity — they're chapter-mode concerns,
        // not generic graph mechanics.
        addCanonicalModule: (canonicalId) => set((s) => {
          const manifest = byCanonical(canonicalId);
          if (!manifest) return {};
          let modules = s.modules;
          // Skip if already present.
          if (modules.some((m) => m.id === canonicalId)) return {};
          modules = [...modules, { id: canonicalId, type: manifest.type, params: manifest.defaults() }];
          // Chapter cascade: adding the canonical env also adds the gate.
          if (canonicalId === byCanonical("_env")?.canonical.id) {
            const gateMan = byCanonical("_gate");
            if (gateMan && !modules.some((m) => m.id === gateMan.canonical.id)) {
              modules = [...modules, { id: gateMan.canonical.id, type: gateMan.type, params: gateMan.defaults() }];
            }
          }
          // Keyboard side-effect: anchor the oscillator at A4=440 so the V/oct
          // math lands on the right notes.
          if (canonicalId === byCanonical("_keyboard")?.canonical.id) {
            modules = patchModuleParams(modules, byCanonical("_osc").canonical.id, { freq: 440 });
          }
          return {
            modules,
            connections: rebuildCanonicalConnections(s.connections, modules),
          };
        }),
        removeCanonicalModule: (canonicalId) => set((s) => {
          // Delegate to removeModuleInstance which already handles requires-cascade
          // and connection cleanup.
          const modules = removeModuleById(s.modules, canonicalId);
          let next = modules;
          let dirty = true;
          while (dirty) {
            dirty = false;
            for (const m of canonicalList()) {
              const req = m.canonical.requires;
              if (!req || !req.length) continue;
              if (!next.some((x) => x.id === m.canonical.id)) continue;
              if (req.every((r) => next.some((x) => x.id === r))) continue;
              next = removeModuleById(next, m.canonical.id);
              dirty = true;
            }
          }
          return {
            modules: next,
            connections: rebuildCanonicalConnections(
              s.connections.filter((c) =>
                next.some((m) => m.id === c.fromId) && next.some((m) => m.id === c.toId)
              ),
              next,
            ),
          };
        }),

        // ---- Free-mode UI actions ----
        setFreeMode:       (freeMode) => set((s) => ({ ui: { ...s.ui, freeMode } })),
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

        // ---- Top-level setters ----
        setVol:            (vol) => set((s) => {
          const outId = byCanonical("_output")?.canonical.id;
          return {
            vol,
            modules: outId ? patchModuleParams(s.modules, outId, { vol }) : s.modules,
          };
        }),
        setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
        setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
        setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),
        setPlaying:        (playing) => set({ playing }),

        // ---- Chapters ----
        goChapter:   (i) => set({ chapter: i }),
        nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),

        // ---- Landing / Journey selection ----
        setStarted: (started) => set({ started }),

        // Pick a journey from the landing picker. Resets the graph and chapter
        // so the visitor always begins from the same blank slate.
        startJourney: (id) => {
          const init = BUILTINS[0].config;
          const { modules, connections } = isLegacyConfig(init)
            ? buildCanonicalGraph(init)
            : { modules: init.modules, connections: init.connections };
          set({
            modules, connections,
            vol: 42,
            ui: { freeMode: false, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
            chapter: 0,
            journeyId: id,
            started: true,
          });
        },

        // Enter free build mode. Does NOT reset the graph — this lets the user
        // continue exploring from whatever patch they just built in a journey.
        // (Landing-page free tile starts from the init graph since the graph
        // is already in init state when the landing page is visible.)
        enterFreeMode: () => set((s) => ({
          ui: { ...s.ui, freeMode: true },
          journeyId: null,
          started: true,
        })),

        // Return to the journey picker. Full reset: empties the graph, clears
        // the active journey, and re-shows the landing page.
        backToJourneys: () => {
          const init = BUILTINS[0].config;
          const { modules, connections } = isLegacyConfig(init)
            ? buildCanonicalGraph(init)
            : { modules: init.modules, connections: init.connections };
          set({
            modules, connections,
            vol: 42,
            ui: { freeMode: false, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
            chapter: 0,
            journeyId: null,
            started: false,
            playing: false,
          });
        },

        // "Start again" — resets the current journey (or free patch) without
        // returning to the picker. Keeps journeyId/started/freeMode untouched.
        resetSession: () => {
          const init = BUILTINS[0].config;
          const { modules, connections } = isLegacyConfig(init)
            ? buildCanonicalGraph(init)
            : { modules: init.modules, connections: init.connections };
          set((s) => ({
            modules, connections,
            vol: 42,
            ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
            chapter: 0,
          }));
        },

        // ---- Presets ----
        loadPreset: (id) => {
          const builtIn = BUILTINS.find((p) => p.id === id);
          const user    = get().presets.user.find((p) => p.id === id);
          const preset  = builtIn || user;
          if (!preset) return;
          const c = preset.config;
          const { modules, connections } = isLegacyConfig(c)
            ? buildCanonicalGraph({ ...c, vol: get().vol })
            : { modules: c.modules, connections: c.connections };
          set((s) => ({
            modules, connections,
            presets: { ...s.presets, activeId: id },
          }));
        },
        savePreset: (name) => set((s) => {
          const preset = makePreset(name, { modules: s.modules, connections: s.connections });
          return { presets: { activeId: preset.id, user: [...s.presets.user, preset] } };
        }),
        deletePreset: (id) => set((s) => {
          const user = s.presets.user.filter((p) => p.id !== id);
          const activeId = s.presets.activeId === id ? "init" : s.presets.activeId;
          return { presets: { activeId, user } };
        }),
        importPresetsJSON: (text) => {
          const incoming = parsePresetsJSON(text);
          set((s) => ({ presets: { ...s.presets, user: [...s.presets.user, ...incoming] } }));
        },
        exportPresetsJSON: () => packPresetsJSON(get().presets.user),
      }),
      {
        name: "smem-v1",
        version: 13,
        partialize: (s) => ({
          modules: s.modules,
          connections: s.connections,
          ui: { ...s.ui, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
          vol: s.vol,
          scope: s.scope,
          chapter: s.chapter,
          started: s.started,
          journeyId: s.journeyId,
          presets: s.presets,
        }),
        migrate: (persisted, version) => {
          if (!persisted) return persisted;
          // ---- v0..v8: legacy migrations operate on { blocks, osc, flt, …}. ----
          if (version < 2 && persisted.flt && persisted.flt.mode == null) {
            persisted.flt.mode = "lowpass";
          }
          if (version < 3 && persisted.scope == null) {
            persisted.scope = { edge: "rising", threshold: 0 };
          }
          if (version < 4 && persisted.scope && persisted.scope.threshold == null) {
            persisted.scope.threshold = 0;
          }
          if (version < 5) {
            if (persisted.blocks && persisted.blocks.lfo == null) persisted.blocks.lfo = false;
            if (persisted.lfo == null) persisted.lfo = { rate: 5, depth: 0.4, shape: "sine" };
          }
          if (version < 6 && persisted.lfo && persisted.lfo.depth > 1) {
            persisted.lfo.depth = persisted.lfo.depth / 2400;
          }
          if (version < 7) {
            if (persisted.blocks && persisted.blocks.keyboard == null) persisted.blocks.keyboard = false;
            if (persisted.keyboard == null) persisted.keyboard = { octave: 4 };
          }
          if (version < 8) {
            if (persisted.blocks && persisted.blocks.gate == null) {
              persisted.blocks.gate = !!persisted.blocks?.env;
            }
          }
          // ---- v9..v11 collapse: derive the canonical graph from whatever
          // legacy shape we have and discard the legacy slot fields. ----
          if (version < 12) {
            if (!persisted.modules || !persisted.connections) {
              const cfg = {
                blocks:   persisted.blocks   || {},
                osc:      persisted.osc      || {},
                flt:      persisted.flt      || {},
                amp:      persisted.amp      || {},
                env:      persisted.env      || {},
                lfo:      persisted.lfo      || {},
                keyboard: persisted.keyboard || { octave: 4 },
                vol:      persisted.vol      ?? 42,
              };
              if (cfg.blocks.keyboard) cfg.osc = { ...cfg.osc, freq: 440 };
              const { modules, connections } = buildCanonicalGraph(cfg);
              persisted.modules = modules;
              persisted.connections = connections;
            } else {
              // v9/v10/v11 already had modules+connections but with legacy
              // param names (q, db) on some canonical instances. Rename and
              // drop redundant legacy slot fields.
              persisted.modules = persisted.modules.map((m) => {
                if (m.type === "filter" && m.params && m.params.q != null && m.params.resonance == null) {
                  const { q, ...rest } = m.params;
                  return { ...m, params: { ...rest, resonance: q } };
                }
                if (m.type === "amp" && m.params && m.params.db != null && m.params.level == null) {
                  const { db, active, ...rest } = m.params;
                  return { ...m, params: { ...rest, level: db } };
                }
                return m;
              });
            }
            // Backfill free-mode positions (v11 logic) for safety.
            let i = 0;
            persisted.modules = persisted.modules.map((m) => {
              if (m.id.startsWith("_") || m.position) return m;
              const pos = { x: 20 + (i % 6) * 250, y: 20 + Math.floor(i / 6) * 240 };
              i += 1;
              return { ...m, position: pos };
            });
            // Migrate user presets to the new shape too.
            if (persisted.presets?.user?.length) {
              persisted.presets.user = persisted.presets.user.map((p) => {
                if (!isLegacyConfig(p.config)) return p;
                const cfg = { ...p.config, vol: persisted.vol ?? 42 };
                if (cfg.blocks?.keyboard) cfg.osc = { ...cfg.osc, freq: 440 };
                const { modules, connections } = buildCanonicalGraph(cfg);
                return { ...p, config: { modules, connections } };
              });
            }
            // Drop legacy slot fields.
            delete persisted.blocks;
            delete persisted.osc; delete persisted.flt; delete persisted.amp;
            delete persisted.env; delete persisted.lfo; delete persisted.keyboard;
            delete persisted.gateSources; delete persisted.held;
            delete persisted.envPhase; delete persisted.envStart;
            persisted.ui = { freeMode: false, armedSource: null, selectedConnectionId: null, focusedModuleSlot: null };
          }
          // ---- v13: introduce the Journey abstraction. Anyone mid-flow on the
          // pre-journey build is on what is now called "signal-flow". ----
          if (version < 13 && persisted.journeyId === undefined) {
            persisted.journeyId = persisted.started ? "signal-flow" : null;
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

// Convenience selector: derives the legacy `blocks` shape from the modules
// array on demand. Used by panels (drawMeter) that still think in blocks.
export const selectBlocks = (s) => deriveBlocks(s.modules);
