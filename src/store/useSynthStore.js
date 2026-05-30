import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { BUILTINS, makePreset, packPresetsJSON, parsePresetsJSON } from "./presets.js";
import { buildCanonicalGraph, buildCanonicalConnections, CANONICAL_IDS } from "./graphBuilder.js";
import { newId } from "../audio/graph/types.js";

const INITIAL_CONFIG = BUILTINS[0].config;
const INITIAL_GRAPH  = buildCanonicalGraph({ ...INITIAL_CONFIG, vol: 42 });

// ---- Helpers ----

// Returns a new modules array with the named module's params patched.
// No-op (returns the same reference) if the module isn't in the array, so
// legacy setters that fire before the canonical module exists (rare, but
// possible during early init) don't blow up.
function patchModuleParams(modules, id, partial) {
  let changed = false;
  const next = modules.map((m) => {
    if (m.id !== id) return m;
    changed = true;
    return { ...m, params: { ...m.params, ...partial } };
  });
  return changed ? next : modules;
}

// Returns a new modules array with the named module replaced (or appended if
// not present).
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

// Recompute the canonical chain after a block flip. Free-mode user-added
// connections (those whose id doesn't start with "_c_") are preserved.
function rebuildCanonicalConnections(prevConnections, blocks) {
  const userConns = prevConnections.filter((c) => !c.id.startsWith("_c_"));
  const canonical = buildCanonicalConnections(blocks);
  return [...canonical, ...userConns];
}

// ---- Store ----

export const useSynthStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      // ===== Canonical typed-port graph (v9) =====
      modules:     INITIAL_GRAPH.modules,
      connections: INITIAL_GRAPH.connections,
      // Free-mode UI state.
      ui: {
        freeMode: false,
        armedSource: null,            // { moduleId, portName } when a user has clicked an output port
        selectedConnectionId: null,
      },

      // ===== Legacy mirror (kept so existing panels can read s.osc.type etc.) =====
      // Every legacy setter dual-writes: the legacy slot AND the matching
      // module's params in the modules array. Bridge subscribes to `modules`
      // only — legacy fields are read-only for the engine.
      blocks: { ...INITIAL_CONFIG.blocks },
      osc:    { ...INITIAL_CONFIG.osc },
      flt:    { ...INITIAL_CONFIG.flt },
      amp:    { ...INITIAL_CONFIG.amp },
      env:    { ...INITIAL_CONFIG.env },
      lfo:    { ...INITIAL_CONFIG.lfo },
      keyboard: { ...INITIAL_CONFIG.keyboard },
      vol:    42,

      // ===== Other persisted state =====
      scope:  { edge: "rising", threshold: 0 },
      chapter: 0,
      started: false,
      settingsOpen: false,
      presets: { activeId: "init", user: [] },

      // ===== Transient =====
      playing:  false,
      gateSources: { keyboard: false, gate: false },
      held:     false,
      envPhase: "idle",
      envStart: 0,

      // ---- New typed-graph actions ----
      // Adds an arbitrary module with the given type and params. Returns the
      // new id. Free-mode UI calls this with no id; presets/chapters can pass
      // a stable id (e.g. CANONICAL_IDS.lfo) to use the reserved slot.
      addModuleInstance: (type, params = {}, fixedId = null) => {
        const id = fixedId || newId();
        const mod = { id, type, params: { ...params } };
        set((s) => ({ modules: upsertModule(s.modules, mod) }));
        return id;
      },
      removeModuleInstance: (id) => set((s) => ({
        modules: removeModuleById(s.modules, id),
        connections: removeConnectionsTouching(s.connections, id),
        ui: { ...s.ui, selectedConnectionId: null, armedSource: null },
      })),
      // Set a single param on an instance. Free-mode panels (step 5) use this;
      // legacy setters below also call it under the hood.
      setModuleParam: (id, key, value) => set((s) => ({
        modules: patchModuleParams(s.modules, id, { [key]: value }),
      })),
      // Connect two ports. Returns the new connection id, or null if the
      // ports aren't found (the bridge will surface compatibility errors).
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

      // ---- Free-mode UI actions ----
      setFreeMode:        (freeMode) => set((s) => ({ ui: { ...s.ui, freeMode } })),
      armSource:          (moduleId, portName, portType) => set((s) => ({
        ui: { ...s.ui, armedSource: { moduleId, portName, portType } }
      })),
      clearArmedSource:   () => set((s) => ({ ui: { ...s.ui, armedSource: null } })),
      selectConnection:   (id) => set((s) => ({ ui: { ...s.ui, selectedConnectionId: id } })),
      clearSelection:     () => set((s) => ({ ui: { ...s.ui, selectedConnectionId: null } })),

      // ---- Legacy param actions (dual-write: legacy slot + canonical module) ----
      setOscType: (type) => set((s) => ({
        osc:     { ...s.osc, type },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.osc, { type }),
      })),
      setOscFreq: (freq) => set((s) => ({
        osc:     { ...s.osc, freq },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.osc, { freq }),
      })),
      setCutoff:  (cutoff) => set((s) => ({
        flt:     { ...s.flt, cutoff },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.filter, { cutoff }),
      })),
      setQ:       (q) => set((s) => ({
        flt:     { ...s.flt, q },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.filter, { q }),
      })),
      setMode:    (mode) => set((s) => ({
        flt:     { ...s.flt, mode },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.filter, { mode }),
      })),
      setAmpDb:   (db) => set((s) => ({
        amp:     { ...s.amp, db },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.amp, { db }),
      })),
      setEnv:     (partial) => set((s) => ({
        env:     { ...s.env, ...partial },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.env, partial),
      })),
      setLfo:     (partial) => set((s) => ({
        lfo:     { ...s.lfo, ...partial },
        modules: patchModuleParams(s.modules, CANONICAL_IDS.lfo, partial),
      })),
      setKeyboardOctave: (octave) => set((s) => ({ keyboard: { ...s.keyboard, octave } })),
      setVol:     (vol) => set((s) => ({
        vol,
        modules: patchModuleParams(s.modules, CANONICAL_IDS.output, { vol }),
      })),
      setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
      setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
      setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),

      // ---- Topology (legacy slot toggles) ----
      // The chapter narrator and AddSlot call these. They flip the legacy
      // `blocks` flag AND mutate the canonical modules + connections arrays
      // to match. Connection ids are reserved so the bridge can diff without
      // rebuilding everything on every change.
      addBlock: (id) => set((s) => {
        const blocks = { ...s.blocks, [id]: true };
        // Cascade: env brings in its Gate trigger module.
        if (id === "env") blocks.gate = true;

        // Keyboard uses A4 = 440 Hz as the V/oct anchor (KeyboardModule emits
        // (midi-69)/12). For the played note to match the labelled key, the
        // oscillator's intrinsic frequency must equal 440 Hz when pitch is wired.
        let osc = s.osc;
        let modules = s.modules;
        if (id === "keyboard") {
          osc = { ...s.osc, freq: 440 };
          modules = patchModuleParams(modules, CANONICAL_IDS.osc, { freq: 440 });
        }
        // Add canonical module for engine-bearing blocks.
        const adds = [
          ["filter",   CANONICAL_IDS.filter,   "filter",     () => ({ ...s.flt })],
          ["amp",      CANONICAL_IDS.amp,      "amp",        () => ({ db: s.amp.db, active: true })],
          ["env",      CANONICAL_IDS.env,      "env",        () => ({ ...s.env })],
          ["lfo",      CANONICAL_IDS.lfo,      "lfo",        () => ({ ...s.lfo })],
          ["keyboard", CANONICAL_IDS.keyboard, "keyboard",   () => ({})],
          ["gate",     CANONICAL_IDS.gate,     "gate",       () => ({})],
        ];
        for (const [slot, canonical, type, mkParams] of adds) {
          if (blocks[slot] && !modules.find((m) => m.id === canonical)) {
            modules = [...modules, { id: canonical, type, params: mkParams() }];
          }
        }

        const connections = rebuildCanonicalConnections(s.connections, blocks);
        return { blocks, osc, modules, connections };
      }),
      removeBlock: (id) => set((s) => {
        const blocks = { ...s.blocks, [id]: false };
        // Cascades: amp also removes env+gate; env removes gate; filter removes lfo.
        if (id === "amp")   { blocks.env = false; blocks.gate = false; }
        if (id === "env")   blocks.gate = false;
        if (id === "filter") blocks.lfo = false;

        let modules = s.modules;
        for (const [slot, canonical] of [
          ["filter",   CANONICAL_IDS.filter],   ["amp",  CANONICAL_IDS.amp],
          ["env",      CANONICAL_IDS.env],      ["lfo",  CANONICAL_IDS.lfo],
          ["keyboard", CANONICAL_IDS.keyboard], ["gate", CANONICAL_IDS.gate],
        ]) {
          if (!blocks[slot]) modules = removeModuleById(modules, canonical);
        }
        const connections = rebuildCanonicalConnections(s.connections, blocks);

        const droppedSource = (id === "env" || id === "amp" || id === "gate" || id === "keyboard");
        const gateSources = droppedSource
          ? { keyboard: false, gate: false }
          : s.gateSources;
        const held = droppedSource ? false : s.held;
        return { blocks, modules, connections, gateSources, held };
      }),

      // ---- Transport / transient ----
      setPlaying:   (playing) => set({ playing }),
      setGateHeld: (source, active) => set((s) => {
        const gateSources = { ...s.gateSources, [source]: !!active };
        return { gateSources, held: Object.values(gateSources).some(Boolean) };
      }),
      clearGate: () => set({ gateSources: { keyboard: false, gate: false }, held: false }),
      setEnvPhase:  (envPhase) => set({ envPhase }),
      markEnvStart: () => set({ envStart: performance.now() }),

      // ---- Chapters ----
      goChapter: (i) => set({ chapter: i }),
      nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),

      // ---- Landing ----
      setStarted: (started) => set({ started }),

      // ---- Session reset: re-derives a fresh canonical graph too ----
      resetSession: () => {
        const cfg = { ...INITIAL_CONFIG, vol: 42 };
        const { modules, connections } = buildCanonicalGraph(cfg);
        set({
          blocks:   { ...INITIAL_CONFIG.blocks },
          osc:      { ...INITIAL_CONFIG.osc },
          flt:      { ...INITIAL_CONFIG.flt },
          amp:      { ...INITIAL_CONFIG.amp },
          env:      { ...INITIAL_CONFIG.env },
          lfo:      { ...INITIAL_CONFIG.lfo },
          keyboard: { ...INITIAL_CONFIG.keyboard },
          modules, connections,
          ui: { freeMode: false, armedSource: null, selectedConnectionId: null },
          chapter:  0,
          started:  false,
          playing:  false,
          gateSources: { keyboard: false, gate: false },
          held:     false,
          envPhase: "idle",
          envStart: 0,
        });
      },

      // ---- Presets ----
      loadPreset: (id) => {
        const builtIn = BUILTINS.find((p) => p.id === id);
        const user    = get().presets.user.find((p) => p.id === id);
        const preset  = builtIn || user;
        if (!preset) return;
        const c = preset.config;
        // Rebuild the canonical graph from the preset's legacy-shape config.
        const cfg = { ...c, vol: get().vol };
        const { modules, connections } = buildCanonicalGraph(cfg);
        set((s) => ({
          blocks: { ...c.blocks },
          osc:    { ...c.osc },
          flt:    { ...c.flt },
          amp:    { ...c.amp },
          env:    { ...c.env },
          lfo:    { ...c.lfo },
          keyboard: { ...(c.keyboard || { octave: 4 }) },
          modules, connections,
          presets: { ...s.presets, activeId: id },
          held: false,
        }));
      },
      savePreset: (name) => set((s) => {
        const preset = makePreset(name, {
          blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo, keyboard: s.keyboard
        });
        return { presets: { activeId: preset.id, user: [...s.presets.user, preset] } };
      }),
      deletePreset: (id) => set((s) => {
        const user = s.presets.user.filter((p) => p.id !== id);
        const activeId = s.presets.activeId === id ? "init" : s.presets.activeId;
        return { presets: { activeId, user } };
      }),
      importPresetsJSON: (text) => {
        const incoming = parsePresetsJSON(text);
        set((s) => ({
          presets: { ...s.presets, user: [...s.presets.user, ...incoming] }
        }));
      },
      exportPresetsJSON: () => packPresetsJSON(get().presets.user)
    }),
    {
      name: "smem-v1",
      version: 10,
      partialize: (s) => ({
        // Canonical graph
        modules: s.modules,
        connections: s.connections,
        ui: { ...s.ui, armedSource: null, selectedConnectionId: null },  // don't persist transient UI
        // Legacy mirror (kept for backwards compatibility + simpler reads)
        blocks: s.blocks,
        osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo,
        keyboard: s.keyboard,
        vol: s.vol,
        scope: s.scope,
        chapter: s.chapter,
        presets: s.presets,
      }),
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
        // ---- Inherit all the legacy v0..v8 migrations ----
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
        // ---- v9: derive canonical modules + connections from legacy config ----
        if (version < 9) {
          const cfg = {
            blocks: persisted.blocks || INITIAL_CONFIG.blocks,
            osc:    persisted.osc    || INITIAL_CONFIG.osc,
            flt:    persisted.flt    || INITIAL_CONFIG.flt,
            amp:    persisted.amp    || INITIAL_CONFIG.amp,
            env:    persisted.env    || INITIAL_CONFIG.env,
            lfo:    persisted.lfo    || INITIAL_CONFIG.lfo,
            vol:    persisted.vol    ?? 42,
          };
          const { modules, connections } = buildCanonicalGraph(cfg);
          persisted.modules = modules;
          persisted.connections = connections;
          persisted.ui = { freeMode: false, armedSource: null, selectedConnectionId: null };
        }
        // ---- v10: env is now control-only (no audio I/O), kb + gate are real
        // engine modules, and the canonical chain wires env.env → amp.level and
        // kb.pitch → osc.pitch + gate.gate → env.trigger. Re-derive the graph
        // so existing v9 sessions pick up the new modules + connections.
        if (version < 10) {
          const cfg = {
            blocks: persisted.blocks || INITIAL_CONFIG.blocks,
            osc:    persisted.osc    || INITIAL_CONFIG.osc,
            flt:    persisted.flt    || INITIAL_CONFIG.flt,
            amp:    persisted.amp    || INITIAL_CONFIG.amp,
            env:    persisted.env    || INITIAL_CONFIG.env,
            lfo:    persisted.lfo    || INITIAL_CONFIG.lfo,
            vol:    persisted.vol    ?? 42,
          };
          // Existing keyboard users had osc.freq write the played note absolutely.
          // The new V/oct flow requires osc.freq = 440 as the A4 reference.
          if (cfg.blocks.keyboard) cfg.osc = { ...cfg.osc, freq: 440 };
          const { modules, connections } = buildCanonicalGraph(cfg);
          persisted.modules = modules;
          persisted.connections = connections;
          if (cfg.blocks.keyboard) persisted.osc = cfg.osc;
        }
        return persisted;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        blocks:      { ...current.blocks,      ...(persisted?.blocks      || {}) },
        flt:         { ...current.flt,         ...(persisted?.flt         || {}) },
        lfo:         { ...current.lfo,         ...(persisted?.lfo         || {}) },
        scope:       { ...current.scope,       ...(persisted?.scope       || {}) },
        keyboard:    { ...current.keyboard,    ...(persisted?.keyboard    || {}) },
        ui:          { ...current.ui,          ...(persisted?.ui          || {}) },
        modules:     persisted?.modules     || current.modules,
        connections: persisted?.connections || current.connections,
      })
    }
    )
  )
);
