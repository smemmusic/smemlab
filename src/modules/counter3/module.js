import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";
import { getEngine } from "../../audio/engineSingleton.js";

// 3-bit binary counter — the wider sibling of the 2-bit counter, sized to
// address an 8→1 multiplexer. A rising edge on `clock` advances the count
// 0 → 7 (mod 8); `reset` snaps it back to 0. The count is exposed as three
// gate outputs, bit0 (LSB) … bit2 (MSB), so the mux can read it as a 3-line
// address and the panel can light one LED per bit. Same gate-aggregation
// contract as the 2-bit counter.
export const COUNT_MOD = 8;
export const BIT_PORTS = ["bit0", "bit1", "bit2"];

export class Counter3Module extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "clock", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    { name: "reset", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    ...BIT_PORTS.map((n) => ({ name: n, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE })),
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

  start() {
    this._emitBits();
  }

  _onClock(sourceId, active) {
    const wasOpen = this._clockSources.size > 0;
    if (active) this._clockSources.add(sourceId);
    else        this._clockSources.delete(sourceId);
    if (!wasOpen && this._clockSources.size > 0) {
      this.count = (this.count + 1) % COUNT_MOD;
      this._emitBits();
    }
  }

  _onReset(sourceId, active) {
    const wasOpen = this._resetSources.size > 0;
    if (active) this._resetSources.add(sourceId);
    else        this._resetSources.delete(sourceId);
    if (!wasOpen && this._resetSources.size > 0) {
      this.count = 0;
      this._emitBits();
    }
  }

  _emitBits() {
    try {
      const engine = getEngine();
      for (let b = 0; b < BIT_PORTS.length; b++) {
        engine.emitGate(this.id, BIT_PORTS[b], this.id, (this.count & (1 << b)) !== 0);
      }
    } catch {}
  }

  setParam() {}

  dispose() {
    this.count = 0;
    this._emitBits();
    super.dispose();
  }
}
