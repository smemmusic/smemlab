import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { BUILTINS, makePreset, packPresetsJSON, parsePresetsJSON } from "./presets.js";

const INITIAL_CONFIG = BUILTINS[0].config;

export const useSynthStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      // Persisted config
      blocks: { ...INITIAL_CONFIG.blocks },
      osc:    { ...INITIAL_CONFIG.osc },
      flt:    { ...INITIAL_CONFIG.flt },
      amp:    { ...INITIAL_CONFIG.amp },
      env:    { ...INITIAL_CONFIG.env },
      lfo:    { ...INITIAL_CONFIG.lfo },
      vol:    42,
      scope:  { edge: "rising", threshold: 0 },    // trigger edge and threshold (-1..+1, 0 = zero-crossing)
      chapter: 0,                                  // current narrator chapter (persisted)
      started: false,                              // landing dismissed (NOT persisted — landing shows on every refresh)
      settingsOpen: false,                         // settings modal visible (NOT persisted — transient UI state)
      presets: { activeId: "init", user: [] },

      // Transient
      playing:  false,
      held:     false,
      envPhase: "idle",
      envStart: 0,

      // Param actions
      setOscType: (type) => set((s) => ({ osc: { ...s.osc, type } })),
      setOscFreq: (freq) => set((s) => ({ osc: { ...s.osc, freq } })),
      setCutoff:  (cutoff) => set((s) => ({ flt: { ...s.flt, cutoff } })),
      setQ:       (q) => set((s) => ({ flt: { ...s.flt, q } })),
      setMode:    (mode) => set((s) => ({ flt: { ...s.flt, mode } })),
      setAmpDb:   (db) => set((s) => ({ amp: { ...s.amp, db } })),
      setEnv:     (partial) => set((s) => ({ env: { ...s.env, ...partial } })),
      setLfo:     (partial) => set((s) => ({ lfo: { ...s.lfo, ...partial } })),
      setVol:     (vol) => set({ vol }),
      setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
      setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
      setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),

      // Topology
      addBlock: (id) => set((s) => ({ blocks: { ...s.blocks, [id]: true } })),
      removeBlock: (id) => set((s) => {
        const blocks = { ...s.blocks, [id]: false };
        // Cascade: removing amp also removes env (env attaches to amp)
        if (id === "amp") blocks.env = false;
        // Cascade: removing filter also removes lfo (lfo modulates filter cutoff)
        if (id === "filter") blocks.lfo = false;
        // Removing env or amp clears held state
        const held = (id === "env" || id === "amp") ? false : s.held;
        return { blocks, held };
      }),

      // Transport / transient
      setPlaying:   (playing) => set({ playing }),
      setHeld:      (held) => set({ held }),
      setEnvPhase:  (envPhase) => set({ envPhase }),
      markEnvStart: () => set({ envStart: performance.now() }),

      // Chapters
      goChapter: (i) => set({ chapter: i }),
      nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),

      // Landing
      setStarted: (started) => set({ started }),

      // Full session reset — wipes synth config + chapter, returns to landing.
      // User presets are intentionally preserved.
      resetSession: () => set({
        blocks:   { ...INITIAL_CONFIG.blocks },
        osc:      { ...INITIAL_CONFIG.osc },
        flt:      { ...INITIAL_CONFIG.flt },
        amp:      { ...INITIAL_CONFIG.amp },
        env:      { ...INITIAL_CONFIG.env },
        lfo:      { ...INITIAL_CONFIG.lfo },
        chapter:  0,
        started:  false,
        playing:  false,
        held:     false,
        envPhase: "idle",
        envStart: 0
      }),

      // Presets
      loadPreset: (id) => {
        const builtIn = BUILTINS.find((p) => p.id === id);
        const user    = get().presets.user.find((p) => p.id === id);
        const preset  = builtIn || user;
        if (!preset) return;
        const c = preset.config;
        set((s) => ({
          blocks: { ...c.blocks },
          osc:    { ...c.osc },
          flt:    { ...c.flt },
          amp:    { ...c.amp },
          env:    { ...c.env },
          lfo:    { ...c.lfo },
          presets: { ...s.presets, activeId: id },
          held: false
        }));
      },
      savePreset: (name) => set((s) => {
        const preset = makePreset(name, {
          blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo
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
      version: 6,
      partialize: (s) => ({
        blocks: s.blocks,
        osc: s.osc,
        flt: s.flt,
        amp: s.amp,
        env: s.env,
        lfo: s.lfo,
        vol: s.vol,
        scope: s.scope,
        chapter: s.chapter,
        // `started` and `settingsOpen` deliberately omitted — transient UI state.
        presets: s.presets
      }),
      // Backfill defaults for older persisted snapshots so we don't crash on undefined keys.
      migrate: (persisted, version) => {
        if (!persisted) return persisted;
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
          // Old depth was in Hz (0..2400); new is a fraction (0..1).
          persisted.lfo.depth = persisted.lfo.depth / 2400;
        }
        return persisted;
      },
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        blocks: { ...current.blocks, ...(persisted?.blocks || {}) },
        flt:    { ...current.flt,    ...(persisted?.flt    || {}) },
        lfo:    { ...current.lfo,    ...(persisted?.lfo    || {}) },
        scope:  { ...current.scope,  ...(persisted?.scope  || {}) }
      })
    }
    )
  )
);
