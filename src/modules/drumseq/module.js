import { WorkletModule } from "../../audio/WorkletModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";

export const TRACKS = 4;
export const STEPS = 16;
// Port names for the four track gate outputs. Kept as bare digits so the
// per-edge port markers stay narrow even with all four lined up on top.
export const TRACK_OUTPUTS = ["1", "2", "3", "4"];

function emptyPattern() {
  return Array.from({ length: TRACKS }, () => Array(STEPS).fill(false));
}

// 4×16 gate sequencer. The `clock` input advances one step per rising edge; the
// `reset` input arms the playhead so the next clock fires step 1. Each track has
// its own gate output that mirrors the incoming clock pulse width whenever the
// current step is active for that track — so the output inherits the clock's
// duty cycle and downstream envelopes see a clean open/close per step. All of it
// (edge detection, stepping, the per-track gate) runs in an AudioWorkletProcessor
// on the audio thread. The pattern is pushed in via postMessage.
const DRUMSEQ_WORKLET_CODE = `
const STEPS = ${STEPS};
class DrumSeqProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = -1;       // -1 = armed; next clock advances to step 0
    this.pClock = 0;
    this.pReset = 0;
    this.pattern = null;  // TRACKS × STEPS booleans
    this._post = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.t === 'param' && d.name === 'pattern') this.pattern = d.value;
    };
  }
  process(inputs, outputs) {
    const clk = inputs[0] && inputs[0][0];
    const rst = inputs[1] && inputs[1][0];
    const T = outputs.length;
    const len = outputs[0][0].length;
    const pat = this.pattern;
    for (let i = 0; i < len; i++) {
      const c = clk ? clk[i] : 0;
      const r = rst ? rst[i] : 0;
      const cr = this.pClock < 0.5 && c >= 0.5; this.pClock = c;
      const rr = this.pReset < 0.5 && r >= 0.5; this.pReset = r;
      if (rr)      this.step = -1;
      else if (cr) this.step = (this.step + 1) % STEPS;
      const high = c >= 0.5 && this.step >= 0;
      for (let t = 0; t < T; t++) {
        const on = high && pat && pat[t] && pat[t][this.step];
        outputs[t][0][i] = on ? 1 : 0;
      }
    }
    if ((this._post = (this._post + 1) & 7) === 0) {
      this.port.postMessage({ t: 'state', s: { stepIdx: this.step } });
    }
    return true;
  }
}
registerProcessor('drumseq-processor', DrumSeqProcessor);
`;

export class DrumSeqModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static PROCESSOR = "drumseq-processor";
  static PROCESSOR_CODE = DRUMSEQ_WORKLET_CODE;
  static PORTS = [
    { name: "clock", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    { name: "reset", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    ...TRACK_OUTPUTS.map((n) => ({ name: n, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE })),
  ];
  static CONTROLS = [];

  constructor(ctx, { pattern } = {}) {
    super(ctx, {});
    this.pattern = pattern || emptyPattern();
    this._postParam("pattern", this.pattern);
  }

  setParam(name, value) {
    if (name === "pattern") { this.pattern = value; this._postParam("pattern", value); }
  }

  getStep() { return this._state.stepIdx ?? -1; }
}
