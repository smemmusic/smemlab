import { newId } from "../../audio/graph/types.js";
import { cloneDeep, loadGraph } from "../graphOps.js";
import { validatePatchObject } from "../patchFile.js";

// Replace the live graph with a saved/imported patch. Drops journey context so
// a loaded patch isn't fought by the chapter delta system (loading a patch puts
// the visitor in free-build). Clones so the live graph never shares references
// with the saved-patches library entry.
function applyPatchObject(set, patch) {
  set({
    ...loadGraph(
      { modules: cloneDeep(patch.modules), connections: cloneDeep(patch.connections) },
      { mobileView: "synth" },
    ),
    journeyId: null,
    started: true,
    patchesOpen: false,
  });
}

// Patch-library slice — the user's named patches plus save/load/import/export.
// Snapshots and restores the graph, but owns none of it: the modules/connections
// live in the graph slice; this slice only persists copies.
export const createPatchSlice = (set, get) => ({
  // Each entry: { id, name, createdAt, patch: { modules, connections } }.
  // Persists with the rest of the store via the zustand persist middleware.
  savedPatches: [],

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
  // Replace the current graph with a saved patch's contents.
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
  // Load a patch from an imported JSON object (file upload). The shape must
  // match the export format produced by serialisePatch.
  loadPatchFromObject: (obj) => {
    const patch = validatePatchObject(obj);
    if (!patch) throw new Error("Not a valid patch file");
    applyPatchObject(set, patch);
  },
});
