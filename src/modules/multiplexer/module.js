import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// 4-to-1 multiplexer (sequential switch). Four CV inputs, a 2-bit address
// (`a0` = ones, `a1` = twos) supplied as gate lines, and one CV output. The
// addressed input passes to the output; the other three are muted.
//
//   in1 → g0 ─┐
//   in2 → g1 ─┤
//   in3 → g2 ─┼─→ out      address = a0 + 2·a1   →   exactly one gain = 1
//   in4 → g3 ─┘
//
// Each input's gain node doubles as that port's CV-input scaler, so wiring a
// source into `inN` feeds the corresponding gain directly. The address sets
// exactly one gain to 1 and the rest to 0 (with a tiny slew so the hand-off
// between steps is click-free). Address lines are gates: each tracks the set
// of sources holding it high, so the bit reads "1" whenever any source drives
// it — matching the counter's bit outputs.
//
// The slew is short enough to read as an instant step (so the pitch lands on
// the new note before the envelope fires) yet long enough to avoid a hard
// discontinuity in the CV.
const SWITCH_TC = 0.002;

export class MultiplexerModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "in1", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in2", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in3", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in4", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "a0",  dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "a1",  dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.index = 0;                  // 0..3, read by the panel
    this._a0 = new Set();
    this._a1 = new Set();

    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.gains = [0, 1, 2, 3].map((i) => {
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0;   // input 1 (address 0) selected at rest
      g.connect(this.out);
      return g;
    });
    // Register each selection gain as the scaler for its CV input port.
    for (let i = 0; i < 4; i++) {
      this._cvPorts.in[`in${i + 1}`] = { scaler: this.gains[i], range: 1, target: null };
    }
    this._registerCvOut("out", this.out);

    this._registerGateInput("a0", (sid, a) => this._onAddr(this._a0, sid, a));
    this._registerGateInput("a1", (sid, a) => this._onAddr(this._a1, sid, a));
  }

  _onAddr(set, sourceId, active) {
    if (active) set.add(sourceId);
    else        set.delete(sourceId);
    this._reselect();
  }

  _reselect() {
    const idx = (this._a0.size > 0 ? 1 : 0) + (this._a1.size > 0 ? 2 : 0);
    if (idx === this.index) return;
    this.index = idx;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
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
