// Built-in presets and import/export helpers.

// depth is normalised 0..1 — destination modules (e.g. the filter) scale it
// to their own units. So 0.4 ≈ "40% of full-scale modulation at the target".
const DEFAULT_LFO = { rate: 5, depth: 0.4, shape: "sine" };
const DEFAULT_KEYBOARD = { octave: 4 };

export const BUILTINS = [
  {
    id: "init",
    name: "Init (oscillator only)",
    builtIn: true,
    config: {
      blocks: { filter: false, amp: false, env: false, lfo: false, keyboard: false, gate: false },
      osc:    { type: "sawtooth", freq: 110 },
      flt:    { cutoff: 1200, q: 1, mode: "lowpass" },
      amp:    { db: 0 },
      env:    { a: 0.05, d: 0.2, sustainDb: -8, r: 0.4 },
      lfo:    { ...DEFAULT_LFO },
      keyboard: { ...DEFAULT_KEYBOARD }
    }
  },
  {
    id: "filter-sweep",
    name: "Filter Sweep Pad",
    builtIn: true,
    config: {
      blocks: { filter: true, amp: true, env: false, lfo: true, keyboard: false, gate: false },
      osc:    { type: "sawtooth", freq: 110 },
      flt:    { cutoff: 1100, q: 6, mode: "lowpass" },
      amp:    { db: -3 },
      env:    { a: 0.05, d: 0.2, sustainDb: -8, r: 0.4 },
      lfo:    { rate: 0.4, depth: 0.35, shape: "sine" },
      keyboard: { ...DEFAULT_KEYBOARD }
    }
  },
  {
    id: "pluck",
    name: "Mellow Pluck",
    builtIn: true,
    config: {
      blocks: { filter: true, amp: true, env: true, lfo: false, keyboard: false, gate: true },
      osc:    { type: "triangle", freq: 220 },
      flt:    { cutoff: 1800, q: 2, mode: "lowpass" },
      amp:    { db: -6 },
      env:    { a: 0.005, d: 0.18, sustainDb: -30, r: 0.25 },
      lfo:    { ...DEFAULT_LFO },
      keyboard: { ...DEFAULT_KEYBOARD }
    }
  },
  {
    id: "stab",
    name: "Sub Stab",
    builtIn: true,
    config: {
      blocks: { filter: true, amp: true, env: true, lfo: false, keyboard: false, gate: true },
      osc:    { type: "square", freq: 73 },
      flt:    { cutoff: 900, q: 8, mode: "lowpass" },
      amp:    { db: 0 },
      env:    { a: 0.005, d: 0.08, sustainDb: -48, r: 0.4 },
      lfo:    { ...DEFAULT_LFO },
      keyboard: { ...DEFAULT_KEYBOARD }
    }
  }
];

export const PRESET_EXPORT_FORMAT = "smem-presets";
export const PRESET_EXPORT_VERSION = 1;

export function packPresetsJSON(userPresets) {
  return JSON.stringify(
    { format: PRESET_EXPORT_FORMAT, version: PRESET_EXPORT_VERSION, presets: userPresets },
    null,
    2
  );
}

export function parsePresetsJSON(text) {
  const obj = JSON.parse(text);
  if (obj?.format !== PRESET_EXPORT_FORMAT) throw new Error("Not a smem-presets file");
  if (!Array.isArray(obj.presets)) throw new Error("Invalid presets payload");
  return obj.presets;
}

export function makePreset(name, config) {
  return {
    id: "user-" + Math.random().toString(36).slice(2, 10),
    name,
    createdAt: Date.now(),
    config: JSON.parse(JSON.stringify(config))
  };
}
