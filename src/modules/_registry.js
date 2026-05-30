// Central registry of every module type. Adding a new module = one import +
// one entry in the MODULES array below. Every other registry in the app
// (MODULE_REGISTRY, MODULE_META, PLACARDS, GLYPHS, PANEL_BY_TYPE, etc.) is
// now derived from this.

import { validateManifest } from "./_types.js";

import { Oscillator } from "./oscillator/index.js";
import { Filter }     from "./filter/index.js";
import { Amp }        from "./amp/index.js";
import { Env }        from "./env/index.js";
import { Lfo }        from "./lfo/index.js";
import { Keyboard }   from "./keyboard/index.js";
import { Gate }       from "./gate/index.js";
import { Output }     from "./output/index.js";
import { Inverter }   from "./inverter/index.js";
import { CvMixer }    from "./cvmixer/index.js";

export const MODULES = [
  Oscillator, Filter, Amp, Env, Lfo,
  Keyboard, Gate, Output,
  Inverter, CvMixer,
];

// Validate at import time. A malformed manifest crashes startup loudly
// instead of producing silent UI/audio bugs deep in some lookup.
const _seenCanonicalIds = new Set();
for (const m of MODULES) {
  validateManifest(m);
  if (m.canonical) {
    if (_seenCanonicalIds.has(m.canonical.id)) {
      throw new Error(`[modules] duplicate canonical id: ${m.canonical.id}`);
    }
    _seenCanonicalIds.add(m.canonical.id);
  }
}

// ---- Lookup helpers (memoised, O(1)) ----

const _byTypeMap      = new Map(MODULES.map((m) => [m.type, m]));
const _byCanonicalMap = new Map(MODULES.filter((m) => m.canonical).map((m) => [m.canonical.id, m]));
const _byBlocksFlag   = new Map(
  MODULES.filter((m) => m.canonical?.blocksFlag).map((m) => [m.canonical.blocksFlag, m])
);

export const byType        = (type)  => _byTypeMap.get(type) || null;
export const byCanonical   = (id)    => _byCanonicalMap.get(id) || null;
export const byBlocksFlag  = (flag)  => _byBlocksFlag.get(flag) || null;

export const paletteList = () =>
  MODULES
    .filter((m) => m.palette?.include)
    .slice()
    .sort((a, b) => (a.palette.order ?? 99) - (b.palette.order ?? 99));

export const canonicalList = () => MODULES.filter((m) => m.canonical);
// "Always present" in chapter mode: no blocksFlag (oscillator, output) —
// these are emitted in every canonical graph regardless of any block state.
export const alwaysPresentCanonicalList = () =>
  MODULES.filter((m) => m.canonical && !m.canonical.blocksFlag);
// "Flag-driven": has a blocksFlag — only emitted when the corresponding flag is true.
export const flagDrivenCanonicalList = () =>
  MODULES.filter((m) => m.canonical?.blocksFlag);
// "Required": cannot be removed in free mode (only output).
export const requiredCanonicalList = () =>
  MODULES.filter((m) => m.canonical?.required);

// All declarative auto-connect templates from every manifest. The
// buildCanonicalConnections function filters this by `when` against the
// current blocks state and emits the actual connection records.
export const allAutoConnects = () =>
  canonicalList().flatMap((m) => m.canonical.autoConnects || []);

// Audio-chain participants sorted by their declared order. Used to derive
// the "_c_<a>_<b>" connections that wire the main signal flow as modules
// come and go (osc → [filter] → [amp] → output, etc.).
export const audioChainParticipants = () =>
  canonicalList()
    .filter((m) => m.canonical.audioChain)
    .slice()
    .sort((a, b) => a.canonical.audioChain.order - b.canonical.audioChain.order);

// Emit chain links between every consecutive *present* audio-chain
// participant. `modules` is the store's modules array; ids that aren't
// instantiated drop out of the chain.
export function chainAudioConnections(modules) {
  const present = audioChainParticipants().filter((m) => isCanonicalPresent(m.canonical.id, modules));
  const conns = [];
  for (let i = 0; i < present.length - 1; i++) {
    const from = present[i].canonical;
    const to = present[i + 1].canonical;
    if (!from.audioChain.outPort || !to.audioChain.inPort) continue;
    conns.push({
      id: `_c_${from.id.slice(1)}_${to.id.slice(1)}`,
      fromId:   from.id, fromPort: from.audioChain.outPort,
      toId:     to.id,   toPort:   to.audioChain.inPort,
    });
  }
  return conns;
}

// Derived view: { filter: boolean, amp: boolean, … } from the current modules
// array. Used by drawMeter + a few legacy chapter-mode UI bits that still
// think in "blocks" semantics. Pass `modules` from the store.
export function deriveBlocks(modules) {
  const present = new Set(modules.map((m) => m.id));
  const blocks = {};
  for (const m of MODULES) {
    const flag = m.canonical?.blocksFlag;
    if (flag) blocks[flag] = present.has(m.canonical.id);
  }
  return blocks;
}

// Returns true iff the canonical instance with this id exists in `modules`.
// Used by buildCanonicalConnections' `when` predicate.
export function isCanonicalPresent(canonicalId, modules) {
  return modules.some((m) => m.id === canonicalId);
}
