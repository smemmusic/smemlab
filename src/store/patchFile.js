// Patch file format: serialisation, validation, and legacy type migration.
// Shared with PatchesModal (re-exported from useSynthStore.js) so it can
// produce + parse the JSON files the user saves and loads.

import { cloneDeep } from "./graphOps.js";

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
export const LEGACY_TYPE_RENAMES = {
  env: "adsrenv",          // ADSR envelope joined the shared EnvelopeModule base
  counter: "counter2",     // counters grouped + named for their bit-width
  multiplexer: "mux4",     // muxes grouped + named for their input count
};

export function renameLegacyTypes(mods) {
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
