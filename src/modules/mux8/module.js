import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// 8-to-1 multiplexer — the wider sibling of the 4→1. Eight CV inputs, a 3-bit
// address (a0 = ones, a1 = twos, a2 = fours) supplied as gate lines, and one
// CV output. The addressed input passes to the output; the other seven are
// muted. Built as eight gain nodes summing into an output gain — the address
// sets exactly one gain to 1. Same crisp, click-free hand-off as the 4→1.
const SWITCH_TC = 0.002;
const N = 8;
const ADDR_PORTS = ["a0", "a1", "a2"];

export class Mux8Module extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    ...Array.from({ length: N }, (_, i) => ({ name: `in${i + 1}`, dir: PORT_DIR.IN, type: PORT_TYPE.CV })),
    ...ADDR_PORTS.map((n) => ({ name: n, dir: PORT_DIR.IN, type: PORT_TYPE.GATE })),
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.index = 0;                  // 0..7, read by the panel
    this._addr = ADDR_PORTS.map(() => new Set());

    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.gains = Array.from({ length: N }, (_, i) => {
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0;   // input 1 (address 0) selected at rest
      g.connect(this.out);
      return g;
    });
    for (let i = 0; i < N; i++) {
      this._cvPorts.in[`in${i + 1}`] = { scaler: this.gains[i], range: 1, target: null };
    }
    this._registerCvOut("out", this.out);

    ADDR_PORTS.forEach((name, bit) => {
      this._registerGateInput(name, (sid, a) => this._onAddr(bit, sid, a));
    });
  }

  _onAddr(bit, sourceId, active) {
    const set = this._addr[bit];
    if (active) set.add(sourceId);
    else        set.delete(sourceId);
    this._reselect();
  }

  _reselect() {
    let idx = 0;
    for (let b = 0; b < this._addr.length; b++) {
      if (this._addr[b].size > 0) idx += 1 << b;
    }
    if (idx === this.index) return;
    this.index = idx;
    const now = this.ctx.currentTime;
    for (let i = 0; i < N; i++) {
      this.gains[i].gain.setTargetAtTime(i === idx ? 1 : 0, now, SWITCH_TC);
    }
  }

  setParam() {}

  dispose() {
    for (const g of this.gains) { try { g.disconnect(); } catch {} }
    try { this.out.disconnect(); } catch {}
    super.dispose();
  }
}
