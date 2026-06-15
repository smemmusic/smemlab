import { AudioModule } from "../../audio/AudioModule.js";
import { GateAggregator } from "../../audio/GateAggregator.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";

// Shared base for the binary counters. A rising edge on `clock` advances the
// count mod 2^BITS; a rising edge on `reset` snaps it to 0. The count is
// exposed as one gate output per bit (bit0 = LSB) so a multiplexer can read it
// as an address and the panel can light one LED per bit.
//
// Both gate inputs aggregate their sources (see GateAggregator) so two
// overlapping gate sources don't double-count a single musical pulse.
// Subclasses declare `static BITS` and `static PORTS = CounterModule.portsForBits(BITS)`.
export class CounterModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static CONTROLS = [];

  // Standard clock/reset gate inputs + one gate output per bit.
  static portsForBits(bits) {
    return [
      { name: "clock", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
      { name: "reset", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
      ...Array.from({ length: bits }, (_, b) => ({ name: `bit${b}`, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE })),
    ];
  }

  constructor(ctx) {
    super(ctx);
    this.count = 0;                  // read by the panel for the LED display
    this._clock = new GateAggregator();
    this._reset = new GateAggregator();
    this._registerGateInput("clock", (sid, a) => this._onClock(sid, a));
    this._registerGateInput("reset", (sid, a) => this._onReset(sid, a));
  }

  get bits() { return this.constructor.BITS; }

  // Push the current address to any wired multiplexer when the graph (re)starts
  // — covers the suspended→running flip where connections already exist.
  start() { this._emitBits(); }

  _onClock(sourceId, active) {
    if (this._clock.update(sourceId, active).rising) {
      this.count = (this.count + 1) % (1 << this.bits);
      this._emitBits();
    }
  }

  _onReset(sourceId, active) {
    if (this._reset.update(sourceId, active).rising) {
      this.count = 0;
      this._emitBits();
    }
  }

  _emitBits() {
    for (let b = 0; b < this.bits; b++) {
      this.emitGate(`bit${b}`, (this.count & (1 << b)) !== 0);
    }
  }

  setParam() {}

  dispose() {
    // Drop all address lines so a downstream multiplexer doesn't latch.
    this.count = 0;
    this._emitBits();
    super.dispose();
  }
}
