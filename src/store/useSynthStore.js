import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { byId as journeyById } from "../content/journeys/index.js";
import { ensureSingleOutput, buildJourneyGraph } from "./graphOps.js";
import { renameLegacyTypes } from "./patchFile.js";
import { createGraphSlice } from "./slices/graphSlice.js";
import { createSessionSlice } from "./slices/sessionSlice.js";
import { createPatchSlice } from "./slices/patchSlice.js";

// The store is composed from three domain slices (zustand slices pattern):
//   graph   — modules + connections + element-level editing actions
//   session — UI/interaction state, transport, journey/landing lifecycle
//   patch   — the saved-patch library + import/export
// They share one set/get so cross-slice actions (e.g. a journey reset that
// swaps the graph) just work; the split is organisational, keeping any single
// file focused. Persistence (which spans all three) is configured here.

// Re-exported for PatchesModal so the patch-file API has a single import site.
export { serialisePatch, validatePatchObject } from "./patchFile.js";
// Re-exported for the Transport: master volume is derived from the output
// module rather than stored as a top-level value.
export { selectVol } from "./graphOps.js";

export const useSynthStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...createGraphSlice(set, get),
        ...createSessionSlice(set, get),
        ...createPatchSlice(set, get),
      }),
      {
        name: "smem-v1",
        version: 16,
        partialize: (s) => ({
          modules: s.modules,
          connections: s.connections,
          ui: { ...s.ui, armedSource: null, dragWire: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1 },
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
          // Backfill renamed key: older builds persisted scopesEnabled (gated
          // only the Oscilloscope component); the unified visualsEnabled covers
          // every Canvas now. Pick up the old preference if present.
          const visualsEnabled =
            persisted?.visualsEnabled
            ?? persisted?.scopesEnabled
            ?? current.visualsEnabled;

          const journey = persisted?.journeyId ? journeyById(persisted.journeyId) : null;
          // Clamp the persisted chapter to the journey's actual length — content
          // may have lost chapters between builds.
          const chapter = journey
            ? Math.max(0, Math.min(persisted.chapter ?? 0, (journey.chapters?.length ?? 1) - 1))
            : (persisted?.chapter ?? current.chapter);

          let modules, connections;
          if (persisted?.started && journey) {
            // Rebuild the journey graph deterministically from content
            // (initialPatch + deltas 0..chapter). The persisted modules are a
            // snapshot that can desync from the chapter pointer after a content
            // edit; rebuilding makes the graph a pure function of
            // (journey, chapter). Trade-off: ad-hoc modules a visitor added in
            // modular view are discarded on reload.
            const fixed = buildJourneyGraph(journey, chapter);
            modules = fixed.modules;
            connections = fixed.connections;
          } else if (persisted?.started) {
            // Free-build / loaded patch: the persisted graph IS the truth —
            // keep it, just enforce the single-Output invariant.
            const fixed = ensureSingleOutput(
              persisted.modules || current.modules,
              persisted.connections || current.connections,
            );
            modules = fixed.modules;
            connections = fixed.connections;
          } else {
            // Pre-landing: the rack stays empty behind the picker; no Output
            // is seeded until the visitor enters the synth view.
            modules = persisted?.modules || current.modules;
            connections = persisted?.connections || current.connections;
          }

          return {
            ...current,
            ...persisted,
            scope:       { ...current.scope, ...(persisted?.scope || {}) },
            ui:          { ...current.ui,    ...(persisted?.ui    || {}) },
            modules,
            connections,
            chapter,
            visualsEnabled,
          };
        },
      }
    )
  )
);
