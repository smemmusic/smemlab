// Single source of truth for everything per-module-type.
//
// Each module lives in `src/modules/<type>/` with four files:
//   - index.js   exports the manifest (this typedef)
//   - module.js  exports the audio class (with static KIND, PORTS, CONTROLS)
//   - panel.jsx  exports the React panel (instance-aware via ModuleInstanceContext)
//   - glyph.jsx  exports the m-head silkscreen SVG (or `null`)
//
// Closely-related modules may be grouped under a family subfolder that also
// holds a shared base class they extend:
//   - `envelopes/`  (adsrenv/, arenv/, adenv/) → EnvelopeModule
//   - `counters/`   (counter2/, counter3/)     → CounterModule
//   - `muxes/`      (mux4/, mux8/)             → MuxModule
// Cross-family gate plumbing lives in `src/audio/GateAggregator.js`.
//
// validateManifest runs at import time on every module; a missing or malformed
// manifest throws loudly at app startup so silent UI/audio bugs from forgotten
// registry entries become impossible.

/**
 * @typedef {Object} ModuleManifest
 * @property {string} type                       module type string ("oscillator", "filter", …)
 * @property {Function} Cls                      AudioModule subclass (carries static KIND, PORTS, CONTROLS)
 * @property {Function} Panel                    React component (instance-aware)
 * @property {{ title: string }} meta            display name; kind is derived from Cls.KIND
 * @property {() => object} defaults             initial params for addModule
 * @property {string} placard                    HTML body shown in the narrator on click
 * @property {*} [glyph]                         m-head silkscreen SVG element (or null)
 *
 * Free-mode palette membership/order/category lives in `_registry.js` (PALETTE_GROUPS).
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
}
