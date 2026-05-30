// Single source of truth for everything per-module-type.
//
// Each module lives in `src/modules/<type>/` with four files:
//   - index.js   exports the manifest (this typedef)
//   - module.js  exports the audio class (with static KIND, PORTS, CONTROLS)
//   - panel.jsx  exports the React panel (instance-aware via ModuleInstanceContext)
//   - glyph.jsx  exports the m-head silkscreen SVG (or `null`)
//
// Registries that USED to be scattered (MODULE_REGISTRY, MODULE_META, PLACARDS,
// GLYPHS, PANEL_BY_TYPE, SLOT_TO_CLASS, TYPE_TO_CLASS, PALETTE_TYPES,
// CANONICAL_IDS, CANONICAL_DEFAULT_POSITIONS, etc.) now all derive from the
// MODULES array in `_registry.js`. Adding a new module type = one new folder
// + one entry in MODULES — nothing else.
//
// validateManifest runs at import time on every module; a missing or malformed
// manifest throws loudly at app startup so silent UI/audio bugs from forgotten
// registry entries become impossible.

/**
 * @typedef {Object} CanonicalConnection
 * @property {string} id                                 reserved connection id, e.g. "_c_lfo_cutoff"
 * @property {{ canonical: string, port: string }} from  source endpoint
 * @property {{ canonical: string, port: string }} to    destination endpoint
 * @property {{ both: string[] }} [when]                 only emit if all listed canonical ids are present
 */

/**
 * Audio-chain participation. Modules in the chain are sorted by `order` and
 * linked in sequence (only present modules participate; gaps collapse).
 * @typedef {Object} AudioChainSpec
 * @property {string|null} inPort   port that receives the upstream link (null = chain head)
 * @property {string|null} outPort  port that emits the downstream link (null = chain tail)
 * @property {number} order         lower = upstream
 */

/**
 * @typedef {Object} CanonicalSpec
 * @property {string} id                                 reserved instance id, e.g. "_osc"
 * @property {boolean} [required]                        true = cannot be removed (output)
 * @property {string} [blocksFlag]                       legacy block flag name ("filter", "amp", …) — omitted if always present
 * @property {{ x: number, y: number }} defaultPosition  free-mode canvas default
 * @property {string[]} [cascadeOnRemove]                canonical ids removed when this one is removed (e.g. env → gate)
 * @property {string[]} [requires]                       this canonical is removed if any of these ids is missing (e.g. lfo → filter)
 * @property {AudioChainSpec} [audioChain]               participation in the main signal chain (osc → filter → amp → output)
 * @property {CanonicalConnection[]} [autoConnects]      side-chain auto-wired connections (modulations, gates) this module owns
 * @property {{ title: string, sub: string }} [addSlot]  chapter "Add slot" UI copy (optional)
 */

/**
 * @typedef {Object} PaletteSpec
 * @property {boolean} include                           shown in the Free Build palette
 * @property {number} [order]                            display order (lower first); defaults to 99
 */

/**
 * @typedef {Object} ModuleManifest
 * @property {string} type                               canonical type string ("oscillator", "filter", …)
 * @property {Function} Cls                              AudioModule subclass (carries static KIND, PORTS, CONTROLS)
 * @property {Function} Panel                            React component (instance-aware)
 * @property {{ title: string }} meta                    display name; kind is derived from Cls.KIND
 * @property {() => object} defaults                     initial params for addModule
 * @property {string} placard                            HTML body shown in the narrator on click
 * @property {*} [glyph]                                 m-head silkscreen SVG element (or null)
 * @property {PaletteSpec} [palette]                     omit = not in palette
 * @property {CanonicalSpec} [canonical]                 omit = free-mode-only (no chapter slot)
 */

const REQUIRED_FIELDS = ["type", "Cls", "Panel", "meta", "defaults", "placard"];

export function validateManifest(m) {
  if (!m || typeof m !== "object") throw new Error(`[modules] manifest must be an object, got ${typeof m}`);
  for (const f of REQUIRED_FIELDS) {
    if (m[f] == null) throw new Error(`[modules] manifest "${m.type ?? "?"}" missing required field: ${f}`);
  }
  if (typeof m.type !== "string" || !m.type) throw new Error(`[modules] manifest has invalid type: ${m.type}`);
  if (typeof m.Cls !== "function") throw new Error(`[modules] manifest "${m.type}" Cls must be a class/function`);
  if (typeof m.Panel !== "function") throw new Error(`[modules] manifest "${m.type}" Panel must be a React component`);
  if (typeof m.meta?.title !== "string") throw new Error(`[modules] manifest "${m.type}" meta.title must be a string`);
  if (typeof m.defaults !== "function") throw new Error(`[modules] manifest "${m.type}" defaults must be a function`);
  if (typeof m.placard !== "string") throw new Error(`[modules] manifest "${m.type}" placard must be a string`);
  if (m.canonical) {
    if (typeof m.canonical.id !== "string" || !m.canonical.id.startsWith("_")) {
      throw new Error(`[modules] manifest "${m.type}" canonical.id must be a reserved "_"-prefixed string`);
    }
    const pos = m.canonical.defaultPosition;
    if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
      throw new Error(`[modules] manifest "${m.type}" canonical.defaultPosition must be { x, y }`);
    }
  }
  if (m.palette && typeof m.palette.include !== "boolean") {
    throw new Error(`[modules] manifest "${m.type}" palette.include must be boolean`);
  }
}
