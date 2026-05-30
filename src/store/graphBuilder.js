// Builds the canonical modules + connections arrays from the legacy
// per-slot config shape (osc/flt/amp/env/lfo, blocks). Used by:
//   - the v8 → v9 store migration
//   - loadPreset (presets still live in legacy shape; they're translated on load)
//   - resetSession (re-derives a fresh canonical graph from defaults)
//
// Canonical IDs are reserved with a leading "_" so they can never collide with
// crypto.randomUUID() output. Free-mode modules (added via the palette) get
// real uuids; chapter / preset modules use the reserved IDs so legacy actions
// (setOscType, etc.) can find them.

export const CANONICAL_IDS = Object.freeze({
  osc:      "_osc",
  filter:   "_filter",
  amp:      "_amp",
  env:      "_env",
  lfo:      "_lfo",
  output:   "_output",
  keyboard: "_keyboard",
  gate:     "_gate",
});

// Default canvas positions used in free mode when a canonical module has no
// stored `position`. Matches the chapter rack's left-to-right signal flow
// roughly so users entering free mode see a familiar layout. User drags
// override these on first move.
export const CANONICAL_DEFAULT_POSITIONS = Object.freeze({
  [CANONICAL_IDS.osc]:      { x: 0,    y: 0   },
  [CANONICAL_IDS.filter]:   { x: 290,  y: 0   },
  [CANONICAL_IDS.amp]:      { x: 580,  y: 0   },
  [CANONICAL_IDS.output]:   { x: 870,  y: 0   },
  [CANONICAL_IDS.keyboard]: { x: 0,    y: 470 },
  [CANONICAL_IDS.lfo]:      { x: 290,  y: 470 },
  [CANONICAL_IDS.env]:      { x: 580,  y: 470 },
  [CANONICAL_IDS.gate]:     { x: 870,  y: 470 },
});

// Returns { modules, connections } for a given legacy config.
//   - osc and output always exist
//   - filter/amp/env/lfo/keyboard/gate exist iff blocks[*] is true
//   - audio path: osc → [filter] → [amp] → output (env is no longer in the
//     audio path — it's a pure control source now)
//   - control wires:
//     - env.env → amp.level     when env + amp present
//     - keyboard.pitch → osc.pitch  when keyboard present
//     - keyboard.gate → env.trigger when keyboard + env present
//     - gate.gate → env.trigger     when gate + env present
//     - lfo.cv → filter.cutoff      when lfo + filter present
export function buildCanonicalGraph(config) {
  const blocks = config.blocks || {};
  const modules = [];

  modules.push({ id: CANONICAL_IDS.osc,    type: "oscillator", params: { ...config.osc } });
  modules.push({ id: CANONICAL_IDS.output, type: "output",     params: { vol: config.vol ?? 80 } });

  if (blocks.filter)   modules.push({ id: CANONICAL_IDS.filter,   type: "filter", params: { ...config.flt } });
  if (blocks.amp)      modules.push({ id: CANONICAL_IDS.amp,      type: "amp",    params: { db: config.amp.db, active: true } });
  if (blocks.env)      modules.push({ id: CANONICAL_IDS.env,      type: "env",    params: { ...config.env } });
  if (blocks.lfo)      modules.push({ id: CANONICAL_IDS.lfo,      type: "lfo",    params: { ...config.lfo } });
  if (blocks.keyboard) modules.push({ id: CANONICAL_IDS.keyboard, type: "keyboard", params: {} });
  if (blocks.gate)     modules.push({ id: CANONICAL_IDS.gate,     type: "gate",     params: {} });

  const connections = buildCanonicalConnections(blocks);
  return { modules, connections };
}

// Connection IDs are reserved (leading "_c_") so the bridge can diff cleanly
// without rebuilding everything on every change.
export function buildCanonicalConnections(blocks) {
  const conns = [];

  // ---- Audio chain: osc → [filter] → [amp] → output ----
  let upstreamId   = CANONICAL_IDS.osc;
  let upstreamPort = "main";

  if (blocks.filter) {
    conns.push({ id: "_c_osc_filter", fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.filter, toPort: "input" });
    upstreamId = CANONICAL_IDS.filter; upstreamPort = "output";
  }
  if (blocks.amp) {
    conns.push({ id: "_c_pre_amp", fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.amp, toPort: "input" });
    upstreamId = CANONICAL_IDS.amp; upstreamPort = "output";
  }
  conns.push({ id: "_c_pre_output", fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.output, toPort: "input" });

  // ---- Control wires ----
  if (blocks.lfo && blocks.filter) {
    conns.push({ id: "_c_lfo_cutoff", fromId: CANONICAL_IDS.lfo, fromPort: "cv", toId: CANONICAL_IDS.filter, toPort: "cutoff" });
  }
  if (blocks.env && blocks.amp) {
    conns.push({ id: "_c_env_amp",    fromId: CANONICAL_IDS.env, fromPort: "env", toId: CANONICAL_IDS.amp,    toPort: "level"  });
  }
  if (blocks.keyboard) {
    conns.push({ id: "_c_kb_pitch",   fromId: CANONICAL_IDS.keyboard, fromPort: "pitch", toId: CANONICAL_IDS.osc, toPort: "pitch" });
  }
  if (blocks.keyboard && blocks.env) {
    conns.push({ id: "_c_kb_gate",    fromId: CANONICAL_IDS.keyboard, fromPort: "gate",  toId: CANONICAL_IDS.env, toPort: "trigger" });
  }
  if (blocks.gate && blocks.env) {
    conns.push({ id: "_c_gate_trig",  fromId: CANONICAL_IDS.gate,     fromPort: "gate",  toId: CANONICAL_IDS.env, toPort: "trigger" });
  }

  return conns;
}
