// Central registry of every module type. Adding a new module = one import +
// one entry in the MODULES array below.

import { validateManifest } from "./_types.js";

import { Oscillator } from "./oscillator/index.js";
import { Filter }     from "./filter/index.js";
import { Amp }        from "./amp/index.js";
import { Env }        from "./env/index.js";
import { ArEnv }      from "./arenv/index.js";
import { AdEnv }      from "./adenv/index.js";
import { Lfo }        from "./lfo/index.js";
import { Keyboard }   from "./keyboard/index.js";
import { Trigger }    from "./trigger/index.js";
import { Clock }      from "./clock/index.js";
import { DrumSeq }    from "./drumseq/index.js";
import { Output }     from "./output/index.js";
import { Inverter }    from "./inverter/index.js";
import { CvMixer }     from "./cvmixer/index.js";
import { Attenuverter } from "./attenuverter/index.js";
import { Attenuator }   from "./attenuator/index.js";
import { Offset }      from "./offset/index.js";
import { AudioMixer }  from "./audiomixer/index.js";

export const MODULES = [
  Oscillator, Filter, Amp, Env, ArEnv, AdEnv, Lfo,
  Keyboard, Trigger, Clock, DrumSeq, Output,
  Inverter, CvMixer, Attenuator, Attenuverter, Offset, AudioMixer,
];

// Palette order. Membership = inclusion; index = display order. Modules absent
// from this array don't appear in the palette. `output` is intentionally
// excluded — every patch has exactly one Output module which the store
// guarantees, so it isn't user-addable.
const PALETTE_ORDER = [
  "oscillator", "filter", "audiomixer", "amp", "env", "arenv", "adenv", "lfo",
  "keyboard", "trigger", "clock", "drumseq",
  "inverter", "attenuator", "attenuverter", "cvmixer", "offset",
];

// Validate at import time. A malformed manifest crashes startup loudly
// instead of producing silent UI/audio bugs deep in some lookup.
for (const m of MODULES) validateManifest(m);
if (new Set(PALETTE_ORDER).size !== PALETTE_ORDER.length) {
  throw new Error(`[modules] PALETTE_ORDER contains duplicates: ${PALETTE_ORDER.join(", ")}`);
}
for (const type of PALETTE_ORDER) {
  if (!MODULES.some((m) => m.type === type)) {
    throw new Error(`[modules] PALETTE_ORDER references unknown module type: ${type}`);
  }
}

const _byTypeMap = new Map(MODULES.map((m) => [m.type, m]));

export const byType      = (type) => _byTypeMap.get(type) || null;
export const paletteList = () => PALETTE_ORDER.map((type) => _byTypeMap.get(type));
