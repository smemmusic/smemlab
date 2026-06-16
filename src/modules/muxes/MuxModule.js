import { WorkletModule } from "../../audio/WorkletModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// Shared base for the N→1 multiplexers (sequential switch). N CV inputs, a
// log2(N)-bit gate address (a0 = ones, a1 = twos, …), and one CV output. The
// addressed input passes through; the rest are muted. Address lines are gate
// signals whose sources sum on the audio bus (any source high ≥ 0.5), matching
// the counter's bit outputs.
//
// Selection, address decode, and a short click-free slew between inputs all run
// in an AudioWorkletProcessor on the audio thread — so the pitch lands on the
// new note (before the envelope fires) without any main-thread polling. The
// slew is short enough to read as an instant step yet long enough to avoid a
// hard discontinuity. Subclasses declare `static INPUTS` (N), `static ADDR`
// (address port names), and `static PORTS = MuxModule.portsFor(INPUTS, ADDR)`.
const MUX_WORKLET_CODE = `
const SWITCH_TC = 0.002;
class MuxProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.n = 0;
    this.bits = 0;
    this.gain = null;   // per-input slewed selection gain
    this.index = 0;
    this._post = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.t === 'param' && d.name === 'config') {
        this.n = d.value.n; this.bits = d.value.bits;
        this.gain = new Float32Array(this.n);
        this.gain[0] = 1;   // input 1 (address 0) selected at rest
      }
    };
  }
  process(inputs, outputs) {
    if (!this.n) return true;
    const out = outputs[0][0];
    const len = out.length;
    const k = 1 - Math.exp(-1 / (SWITCH_TC * sampleRate));
    for (let i = 0; i < len; i++) {
      let idx = 0;
      for (let b = 0; b < this.bits; b++) {
        const ab = inputs[this.n + b];
        const v = (ab && ab[0]) ? ab[0][i] : 0;
        if (v >= 0.5) idx += (1 << b);
      }
      let acc = 0;
      for (let j = 0; j < this.n; j++) {
        const target = j === idx ? 1 : 0;
        this.gain[j] += (target - this.gain[j]) * k;
        const inj = inputs[j];
        const s = (inj && inj[0]) ? inj[0][i] : 0;
        acc += s * this.gain[j];
      }
      out[i] = acc;
      this.index = idx;
    }
    if ((this._post = (this._post + 1) & 7) === 0) {
      this.port.postMessage({ t: 'state', s: { index: this.index } });
    }
    return true;
  }
}
registerProcessor('mux-processor', MuxProcessor);
`;

export class MuxModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static CONTROLS = [];
  static PROCESSOR = "mux-processor";
  static PROCESSOR_CODE = MUX_WORKLET_CODE;

  static portsFor(inputs, addr) {
    return [
      ...Array.from({ length: inputs }, (_, i) => ({ name: `in${i + 1}`, dir: PORT_DIR.IN, type: PORT_TYPE.CV })),
      ...addr.map((n) => ({ name: n, dir: PORT_DIR.IN, type: PORT_TYPE.GATE })),
      { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
    ];
  }

  constructor(ctx) {
    super(ctx, {});
    const { INPUTS, ADDR } = this.constructor;
    this._postParam("config", { n: INPUTS, bits: ADDR.length });
  }

  getIndex() { return this._state.index ?? 0; }
}
