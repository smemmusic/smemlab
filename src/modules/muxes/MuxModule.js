import { AudioModule } from "../../audio/AudioModule.js";
import { GateAggregator } from "../../audio/GateAggregator.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// Shared base for the N→1 multiplexers (sequential switch). N CV inputs, a
// log2(N)-bit gate address (a0 = ones, a1 = twos, …), and one CV output. The
// addressed input passes through; the rest are muted. Each input's gain node
// doubles as that port's CV-input scaler, so a source wired into `inN` feeds
// its gain directly; the address sets exactly one gain to 1 (with a short slew
// so the hand-off is click-free).
//
// Address lines are gates whose sources aggregate (see GateAggregator) so a bit
// reads "1" whenever any source drives it — matching the counter's bit outputs.
// Subclasses declare `static INPUTS` (N) and `static ADDR` (address port names),
// and `static PORTS = MuxModule.portsFor(INPUTS, ADDR)`.
//
// The slew is short enough to read as an instant step (so the pitch lands on
// the new note before the envelope fires) yet long enough to avoid a hard
// discontinuity in the CV.
const SWITCH_TC = 0.002;

export class MuxModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static CONTROLS = [];

  static portsFor(inputs, addr) {
    return [
      ...Array.from({ length: inputs }, (_, i) => ({ name: `in${i + 1}`, dir: PORT_DIR.IN, type: PORT_TYPE.CV })),
      ...addr.map((n) => ({ name: n, dir: PORT_DIR.IN, type: PORT_TYPE.GATE })),
      { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
    ];
  }

  constructor(ctx) {
    super(ctx);
    const { INPUTS, ADDR } = this.constructor;
    this.index = 0;                  // 0..INPUTS-1, read by the panel
    this._addr = ADDR.map(() => new GateAggregator());

    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.gains = Array.from({ length: INPUTS }, (_, i) => {
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0;   // input 1 (address 0) selected at rest
      g.connect(this.out);
      return g;
    });
    // Register each selection gain as the scaler for its CV input port.
    for (let i = 0; i < INPUTS; i++) {
      this._cvPorts.in[`in${i + 1}`] = { scaler: this.gains[i], range: 1, target: null };
    }
    this._registerCvOut("out", this.out);

    ADDR.forEach((name, bit) => {
      this._registerGateInput(name, (sid, a) => this._onAddr(bit, sid, a));
    });
  }

  _onAddr(bit, sourceId, active) {
    this._addr[bit].update(sourceId, active);
    this._reselect();
  }

  _reselect() {
    let idx = 0;
    for (let b = 0; b < this._addr.length; b++) {
      if (this._addr[b].isHigh) idx += 1 << b;
    }
    if (idx === this.index) return;
    this.index = idx;
    const now = this.ctx.currentTime;
    for (let i = 0; i < this.gains.length; i++) {
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
