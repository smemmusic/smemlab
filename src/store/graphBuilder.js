// Canonical graph construction. Derives reserved instance ids, default
// positions, and the chapter-mode auto-wired connections from each module's
// manifest in `src/modules/`. Adding a new canonical module requires no
// edits to this file — declare `canonical: { id, blocksFlag, defaultPosition,
// audioChain?, autoConnects? }` on the new module's manifest.

import {
  canonicalList,
  alwaysPresentCanonicalList,
  flagDrivenCanonicalList,
  allAutoConnects,
  chainAudioConnections,
  isCanonicalPresent,
  byBlocksFlag,
  byCanonical,
} from "../modules/_registry.js";

// Reserved instance ids exposed as a literal so callers can write
// `CANONICAL_IDS.osc` / `.filter` / etc. without a registry lookup each time.
// Keys match the legacy blocksFlag where defined ("filter", "amp", "env",
// "lfo", "keyboard", "gate") plus "osc" and "output" for the always-present ones.
export const CANONICAL_IDS = (() => {
  const map = {};
  for (const m of canonicalList()) {
    const friendlyKey = m.canonical.blocksFlag
      || (m.type === "oscillator" ? "osc" : m.type);
    map[friendlyKey] = m.canonical.id;
  }
  return Object.freeze(map);
})();

// Default free-mode canvas positions, derived from manifests.
export const CANONICAL_DEFAULT_POSITIONS = (() => {
  const map = {};
  for (const m of canonicalList()) {
    map[m.canonical.id] = m.canonical.defaultPosition;
  }
  return Object.freeze(map);
})();

// Build the canonical { modules, connections } graph for a given legacy-shape
// config. Used by the v8→v9/v12 store migration and by loadPreset for any
// preset still saved in the legacy {blocks, osc, flt, …} format.
// New canonical instances pull params from the legacy slot fields when
// available, falling back to the manifest's defaults().
export function buildCanonicalGraph(legacyConfig) {
  const blocks = legacyConfig.blocks || {};
  const modules = [];

  for (const m of alwaysPresentCanonicalList()) {
    modules.push({
      id: m.canonical.id,
      type: m.type,
      params: paramsForCanonical(m, legacyConfig),
    });
  }
  for (const m of flagDrivenCanonicalList()) {
    if (!blocks[m.canonical.blocksFlag]) continue;
    modules.push({
      id: m.canonical.id,
      type: m.type,
      params: paramsForCanonical(m, legacyConfig),
    });
  }

  const connections = buildCanonicalConnections(modules);
  return { modules, connections };
}

// Map a manifest type to the legacy config field name ("filter" → "flt", etc.).
const LEGACY_PARAM_KEY = {
  oscillator: "osc",
  filter:     "flt",
  amp:        "amp",
  env:        "env",
  lfo:        "lfo",
  keyboard:   "keyboard",
};

function paramsForCanonical(manifest, legacyConfig) {
  const legacyKey = LEGACY_PARAM_KEY[manifest.type];
  const legacy = legacyKey ? legacyConfig[legacyKey] : null;
  const defaults = manifest.defaults();
  // Legacy "flt" used `q`; new canonical filter uses `resonance`.
  if (legacy && manifest.type === "filter" && legacy.q != null && legacy.resonance == null) {
    const { q, ...rest } = legacy;
    return { ...defaults, ...rest, resonance: q };
  }
  // Legacy "amp" used `db`; new canonical amp uses `level`.
  if (legacy && manifest.type === "amp" && legacy.db != null && legacy.level == null) {
    const { db, active, ...rest } = legacy;
    return { ...defaults, ...rest, level: db };
  }
  if (manifest.type === "output") {
    return { ...defaults, vol: legacyConfig.vol ?? defaults.vol };
  }
  return legacy ? { ...defaults, ...legacy } : defaults;
}

// Emit all canonical connections for the current `modules` array. Combines
// the audio chain (osc → [filter] → [amp] → output, gaps collapse) with each
// manifest's declarative `autoConnects` (side-chain modulations + gates).
export function buildCanonicalConnections(modules) {
  const conns = [...chainAudioConnections(modules)];
  for (const c of allAutoConnects()) {
    const whenSatisfied = !c.when || (c.when.both || []).every((id) => isCanonicalPresent(id, modules));
    if (!whenSatisfied) continue;
    // Also drop autoConnects whose endpoints aren't both present (e.g.
    // env.env → amp.level with env present but amp removed).
    if (!isCanonicalPresent(c.from.canonical, modules)) continue;
    if (!isCanonicalPresent(c.to.canonical,   modules)) continue;
    conns.push({
      id: c.id,
      fromId:   c.from.canonical,
      fromPort: c.from.port,
      toId:     c.to.canonical,
      toPort:   c.to.port,
    });
  }
  return conns;
}

// Re-export helpers for callers that still want the old names.
export { byBlocksFlag, byCanonical };
