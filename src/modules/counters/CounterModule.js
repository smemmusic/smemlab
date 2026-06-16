import { WorkletModule } from "../../audio/WorkletModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";

// Shared base for the binary counters. A rising edge on `clock` advances the
// count mod 2^BITS; a rising edge on `reset` snaps it to 0. The count is exposed
// as one gate output per bit (bit0 = LSB) so a multiplexer can read it as an
// address and the panel can light one LED per bit.
//
// Counting and bit fan-out run in an AudioWorkletProcessor: clock/reset are
// summed gate-signal inputs (any source high ≥ 0.5), edge-detected per sample,
// and each bit is driven as a continuous 0/1 level — all on the audio thread.
// The processor uses outputs.length as the bit-width, so the 2- and 3-bit
// variants share one processor. Subclasses declare `static BITS` and
// `static PORTS = CounterModule.portsForBits(BITS)`.
const COUNTER_WORKLET_CODE = `
class CounterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.count = 0;
    this.pClock = 0;
    this.pReset = 0;
    this._post = 0;
  }
  process(inputs, outputs) {
    const clk = inputs[0] && inputs[0][0];
    const rst = inputs[1] && inputs[1][0];
    const bits = outputs.length;
    const mod = 1 << bits;
    const len = outputs[0][0].length;
    for (let i = 0; i < len; i++) {
      const c = clk ? clk[i] : 0;
      const r = rst ? rst[i] : 0;
      const cr = this.pClock < 0.5 && c >= 0.5; this.pClock = c;
      const rr = this.pReset < 0.5 && r >= 0.5; this.pReset = r;
      if (rr)      this.count = 0;
      else if (cr) this.count = (this.count + 1) % mod;
      for (let b = 0; b < bits; b++) outputs[b][0][i] = (this.count & (1 << b)) ? 1 : 0;
    }
    if ((this._post = (this._post + 1) & 7) === 0) {
      this.port.postMessage({ t: 'state', s: { count: this.count } });
    }
    return true;
  }
}
registerProcessor('counter-processor', CounterProcessor);
`;

export class CounterModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static CONTROLS = [];
  static PROCESSOR = "counter-processor";
  static PROCESSOR_CODE = COUNTER_WORKLET_CODE;

  // Standard clock/reset gate inputs + one gate output per bit.
  static portsForBits(bits) {
    return [
      { name: "clock", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
      { name: "reset", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
      ...Array.from({ length: bits }, (_, b) => ({ name: `bit${b}`, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE })),
    ];
  }

  get bits()  { return this.constructor.BITS; }
  getCount()  { return this._state.count ?? 0; }
}
