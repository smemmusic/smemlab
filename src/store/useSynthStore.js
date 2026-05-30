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
      vol:    42,
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
      setAmpDb:   (db) => set((s) => ({ amp: { ...s.amp, db } })),
      setEnv:     (partial) => set((s) => ({ env: { ...s.env, ...partial } })),
      setVol:     (vol) => set({ vol }),

      // Topology
      addBlock: (id) => set((s) => ({ blocks: { ...s.blocks, [id]: true } })),
      removeBlock: (id) => set((s) => {
        const blocks = { ...s.blocks, [id]: false };
        // Cascade: removing amp also removes env (env attaches to amp)
        if (id === "amp") blocks.env = false;
        // Removing env or amp clears held state
        const held = (id === "env" || id === "amp") ? false : s.held;
        return { blocks, held };
      }),

      // Transport / transient
      setPlaying:   (playing) => set({ playing }),
      setHeld:      (held) => set({ held }),
      setEnvPhase:  (envPhase) => set({ envPhase }),
      markEnvStart: () => set({ envStart: performance.now() }),

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
          presets: { ...s.presets, activeId: id },
          held: false
        }));
      },
      savePreset: (name) => set((s) => {
        const preset = makePreset(name, {
          blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env
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
      version: 1,
      partialize: (s) => ({
        blocks: s.blocks,
        osc: s.osc,
        flt: s.flt,
        amp: s.amp,
        env: s.env,
        vol: s.vol,
        presets: s.presets
      })
    }
    )
  )
);
