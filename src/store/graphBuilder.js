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
  osc:    "_osc",
  filter: "_filter",
  amp:    "_amp",
  env:    "_env",
  lfo:    "_lfo",
  output: "_output",
});

// Returns { modules, connections } for a given legacy config.
//   - osc and output always exist
//   - filter/amp/env/lfo exist iff blocks[*] is true
//   - connections form the chain: osc → [filter] → [env audio] → [amp] → output
//     plus LFO → filter.cutoff when both present.
// IDs are deterministic so re-running with the same config produces the same
// shape (helpful for migration idempotency).
export function buildCanonicalGraph(config) {
  const blocks = config.blocks || {};
  const modules = [];

  // Always: osc + output.
  modules.push({ id: CANONICAL_IDS.osc, type: "oscillator", params: { ...config.osc } });
  modules.push({ id: CANONICAL_IDS.output, type: "output", params: { vol: config.vol ?? 80 } });

  if (blocks.filter) {
    modules.push({
      id: CANONICAL_IDS.filter,
      type: "filter",
      params: { ...config.flt },
    });
  }
  if (blocks.amp) {
    modules.push({
      id: CANONICAL_IDS.amp,
      type: "amp",
      params: { db: config.amp.db, active: true },
    });
  }
  if (blocks.env) {
    modules.push({
      id: CANONICAL_IDS.env,
      type: "env",
      params: { ...config.env },
    });
  }
  if (blocks.lfo) {
    modules.push({
      id: CANONICAL_IDS.lfo,
      type: "lfo",
      params: { ...config.lfo },
    });
  }

  const connections = buildCanonicalConnections(blocks);
  return { modules, connections };
}

// Connection IDs are also reserved (leading "_") so they survive
// round-trips through the diff-based bridge without churn.
export function buildCanonicalConnections(blocks) {
  const conns = [];
  let upstreamId   = CANONICAL_IDS.osc;
  let upstreamPort = "main";

  if (blocks.filter) {
    conns.push({ id: "_c_osc_filter",  fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.filter, toPort: "input" });
    upstreamId = CANONICAL_IDS.filter; upstreamPort = "output";
  }
  if (blocks.env) {
    conns.push({ id: "_c_pre_env",     fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.env, toPort: "input" });
    upstreamId = CANONICAL_IDS.env; upstreamPort = "output";
  }
  if (blocks.amp) {
    conns.push({ id: "_c_pre_amp",     fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.amp, toPort: "input" });
    upstreamId = CANONICAL_IDS.amp; upstreamPort = "output";
  }
  conns.push({ id: "_c_pre_output",    fromId: upstreamId, fromPort: upstreamPort, toId: CANONICAL_IDS.output, toPort: "input" });
  if (blocks.lfo && blocks.filter) {
    conns.push({ id: "_c_lfo_cutoff",  fromId: CANONICAL_IDS.lfo, fromPort: "cv", toId: CANONICAL_IDS.filter, toPort: "cutoff" });
  }
  return conns;
}
