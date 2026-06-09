// Aggregates the set of upstream sources currently driving a single gate /
// trigger input. A physical gate input can be patched from several sources at
// once (two triggers into one envelope, a clock plus a manual button, a counter
// bit feeding a mux address …). A module should react to the *aggregate* "any
// source high" signal, not to each source independently — otherwise two
// overlapping pulses double-fire one musical event.
//
// Feed every per-source change through update() and use the returned edges for
// edge-triggered behaviour (envelopes firing, counters advancing), or read
// `isHigh` for level behaviour (a mux address bit). This is the one place the
// no-double-count contract lives, shared across the envelope/counter/mux/clock
// families.
export class GateAggregator {
  constructor() { this._sources = new Set(); }

  // True while at least one source holds this gate high.
  get isHigh() { return this._sources.size > 0; }

  // Apply one source's state change. Returns the aggregate transition:
  //   rising  — flipped from no-source to any-source on this call
  //   falling — flipped from any-source to no-source on this call
  //   isHigh  — the aggregate level after the change
  update(sourceId, active) {
    const wasHigh = this._sources.size > 0;
    if (active) this._sources.add(sourceId);
    else        this._sources.delete(sourceId);
    const isHigh = this._sources.size > 0;
    return { rising: !wasHigh && isHigh, falling: wasHigh && !isHigh, isHigh };
  }

  clear() { this._sources.clear(); }
}
