// Central registry of every module type. Adding a new module = one import +
// one entry in the MODULES array below.

import { validateManifest } from "./_types.js";

import { Oscillator } from "./oscillator/index.js";
import { Filter }     from "./filter/index.js";
import { Amp }        from "./amp/index.js";
import { AdsrEnv }    from "./envelopes/adsrenv/index.js";
import { ArEnv }      from "./envelopes/arenv/index.js";
import { AdEnv }      from "./envelopes/adenv/index.js";
import { Lfo }        from "./lfo/index.js";
import { Keyboard }   from "./keyboard/index.js";
import { Trigger }    from "./trigger/index.js";
import { Clock }      from "./clock/index.js";
import { DrumSeq }    from "./drumseq/index.js";
import { Counter }     from "./counter/index.js";
import { Counter3 }    from "./counter3/index.js";
import { Multiplexer } from "./multiplexer/index.js";
import { Mux8 }        from "./mux8/index.js";
import { Quantizer }   from "./quantizer/index.js";
import { Output }     from "./output/index.js";
import { Inverter }    from "./inverter/index.js";
import { CvMixer }     from "./cvmixer/index.js";
import { Attenuverter } from "./attenuverter/index.js";
import { Attenuator }   from "./attenuator/index.js";
import { Offset }      from "./offset/index.js";
import { AudioMixer }  from "./audiomixer/index.js";

export const MODULES = [
  Oscillator, Filter, Amp, AdsrEnv, ArEnv, AdEnv, Lfo,
  Keyboard, Trigger, Clock, DrumSeq, Counter, Counter3, Multiplexer, Mux8, Quantizer, Output,
  Inverter, CvMixer, Attenuator, Attenuverter, Offset, AudioMixer,
];

// Palette grouping. Modules are organised into categories; within each group
// the `types` order is the display order, and the groups themselves display
// top-to-bottom in array order. Membership here = palette inclusion: a module
// absent from every group doesn't appear in the palette. `output` is
// intentionally excluded — every patch has exactly one Output module which the
// store guarantees, so it isn't user-addable.
const PALETTE_GROUPS = [
  { key: "audio",      label: "Audio",      types: ["oscillator", "filter", "audiomixer", "amp"] },
  { key: "modulation", label: "Modulation", types: ["adsrenv", "arenv", "adenv", "lfo"] },
  { key: "trigger",    label: "Trigger",    types: ["keyboard", "trigger", "clock", "drumseq"] },
  { key: "logic",      label: "Logic",      types: ["counter", "counter3", "multiplexer", "mux8"] },
  { key: "utility",    label: "Utility",    types: ["quantizer", "inverter", "attenuator", "attenuverter", "cvmixer", "offset"] },
];

// Flattened palette order, derived from the groups.
const PALETTE_ORDER = PALETTE_GROUPS.flatMap((g) => g.types);

// Validate at import time. A malformed manifest crashes startup loudly
// instead of producing silent UI/audio bugs deep in some lookup.
for (const m of MODULES) validateManifest(m);
if (new Set(PALETTE_ORDER).size !== PALETTE_ORDER.length) {
  throw new Error(`[modules] PALETTE_GROUPS contains duplicate types: ${PALETTE_ORDER.join(", ")}`);
}
for (const type of PALETTE_ORDER) {
  if (!MODULES.some((m) => m.type === type)) {
    throw new Error(`[modules] PALETTE_GROUPS references unknown module type: ${type}`);
  }
}

const _byTypeMap = new Map(MODULES.map((m) => [m.type, m]));

export const byType      = (type) => _byTypeMap.get(type) || null;
export const paletteList = () => PALETTE_ORDER.map((type) => _byTypeMap.get(type));
// Same modules as paletteList(), but bucketed by category for a grouped UI:
// [{ key, label, items: Manifest[] }, …] in display order.
export const paletteGroups = () =>
  PALETTE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.types.map((type) => _byTypeMap.get(type)),
  }));
