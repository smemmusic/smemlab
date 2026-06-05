import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";
import { getEngine } from "../../audio/engineSingleton.js";

// 2-bit binary counter. A rising edge on `clock` advances the count
// 0 → 1 → 2 → 3 → 0 (mod 4); a rising edge on `reset` snaps it back to 0.
// The count is exposed as two independent gate outputs — `bit0` (the ones
// place / LSB) and `bit1` (the twos place / MSB) — so a downstream
// multiplexer can read it as a 2-line address, and the panel can light one
// LED per bit to make binary counting visible.
//
// Gate aggregation mirrors the drum sequencer: each input tracks the set of
// sources currently holding it high, so the *transition* from no-source to
// any-source is the rising edge that advances / resets. That keeps two
// overlapping gate sources from double-counting a single musical pulse.
export const COUNT_MOD = 4;

export class CounterModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "clock", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "reset", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "bit0",  dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
    { name: "bit1",  dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.count = 0;                  // read by the panel for the LED display
    this._clockSources = new Set();
    this._resetSources = new Set();
    this._registerGateInput("clock", (sid, a) => this._onClock(sid, a));
    this._registerGateInput("reset", (sid, a) => this._onReset(sid, a));
  }

  // Push the current address to any wired multiplexer when the graph (re)starts
  // — covers the suspended→running flip where connections already exist.
  start() {
    this._emitBits();
  }

  _onClock(sourceId, active) {
    const wasOpen = this._clockSources.size > 0;
    if (active) this._clockSources.add(sourceId);
    else        this._clockSources.delete(sourceId);
    const nowOpen = this._clockSources.size > 0;
    if (!wasOpen && nowOpen) {
      this.count = (this.count + 1) % COUNT_MOD;
      this._emitBits();
    }
  }

  _onReset(sourceId, active) {
    const wasOpen = this._resetSources.size > 0;
    if (active) this._resetSources.add(sourceId);
    else        this._resetSources.delete(sourceId);
    const nowOpen = this._resetSources.size > 0;
    if (!wasOpen && nowOpen) {
      this.count = 0;
      this._emitBits();
    }
  }

  _emitBits() {
    try {
      const engine = getEngine();
      engine.emitGate(this.id, "bit0", this.id, (this.count & 1) !== 0);
      engine.emitGate(this.id, "bit1", this.id, (this.count & 2) !== 0);
    } catch {}
  }

  setParam() {}

  dispose() {
    // Drop both address lines so a downstream multiplexer doesn't latch.
    this.count = 0;
    this._emitBits();
    super.dispose();
  }
}
