import { WorkletModule } from "../../audio/WorkletModule.js";
import { DB_FLOOR } from "../../audio/constants.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// Shared base for the envelope family (ADSR / AR / AD). The whole envelope —
// gate-edge detection and the per-sample A/D/(S)/R ramp — runs in one
// AudioWorkletProcessor, so its trigger timing and CV output are sample-accurate
// and never touch the main thread. The output is the normalised shape CV
// (0 = release floor, 1 = peak) in dB-space, matching the old ConstantSource
// `cvOut` exactly (the old internal meter GainNode with its exponential peak
// boost was display-only and is replaced by the snapshot `value`).
//
// Subclasses provide only:
//   static CONTROLS — the knob set (a/d/s/r, a/r, a/d). Each knob becomes a
//                     worklet AudioParam with a cvRange-scaled CV input, summed
//                     and read at the gate edge (matching the old _effective()).
//   static MODE     — "adsr" | "ad" | "ar" — selects the segment behaviour.
//
// The processor multi-source-sums its gate input automatically (Web Audio mixes
// connections), so two triggers into one envelope read as "any source high"
// via a 0.5 threshold — the old GateAggregator contract, now sample-accurate.
const ENV_WORKLET_CODE = `
const DB_FLOOR = ${DB_FLOOR};
class EnvelopeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'a', defaultValue: 0.01, minValue: 0, maxValue: 60, automationRate: 'k-rate' },
      { name: 'd', defaultValue: 0.2,  minValue: 0, maxValue: 60, automationRate: 'k-rate' },
      { name: 's', defaultValue: -8,   minValue: -96, maxValue: 48, automationRate: 'k-rate' },
      { name: 'r', defaultValue: 0.4,  minValue: 0, maxValue: 60, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.mode = 'adsr';
    this.phase = 'idle';   // idle | attack | decay | sustain | release
    this.value = 0;        // 0..1 normalised shape
    this.target = 0;
    this.step = 0;
    this.rem = 0;          // samples left in the current ramp (0 = holding)
    this.sustain = 0;      // sustain level captured at attack
    this.prevGate = 0;
    this.trig = 0;         // increments per rising edge (panel animation reset)
    this._post = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.t === 'param' && d.name === 'mode') this.mode = d.value;
    };
  }
  _edge(parameters) {
    let s = parameters.s[0]; if (s < DB_FLOOR) s = DB_FLOOR; else if (s > 0) s = 0;
    return {
      a: Math.max(0.001, parameters.a[0]),
      d: Math.max(0.001, parameters.d[0]),
      s,
      r: Math.max(0.001, parameters.r[0]),
    };
  }
  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    const gin = inputs[0] && inputs[0][0];
    const len = out.length;
    let p = null;
    for (let i = 0; i < len; i++) {
      const g = gin ? gin[i] : 0;
      const rising  = this.prevGate < 0.5 && g >= 0.5;
      const falling = this.prevGate >= 0.5 && g < 0.5;
      this.prevGate = g;
      if (rising) {
        if (!p) p = this._edge(parameters);
        const dur = Math.max(1, p.a * sampleRate);
        this.target = 1; this.step = (1 - this.value) / dur; this.rem = dur;
        this.phase = 'attack';
        this.sustain = (p.s - DB_FLOOR) / (-DB_FLOOR);
        this.trig++;
      } else if (falling && this.mode !== 'ad') {
        if (!p) p = this._edge(parameters);
        const dur = Math.max(1, p.r * sampleRate);
        this.target = 0; this.step = (0 - this.value) / dur; this.rem = dur;
        this.phase = 'release';
      }
      if (this.rem > 0) {
        this.value += this.step; this.rem--;
        if (this.rem <= 0) {
          this.value = this.target;
          if (this.phase === 'attack') {
            if (this.mode === 'ar') {
              this.phase = 'sustain';
            } else {
              if (!p) p = this._edge(parameters);
              const dur = Math.max(1, p.d * sampleRate);
              const tgt = this.mode === 'ad' ? 0 : this.sustain;
              this.target = tgt; this.step = (tgt - this.value) / dur; this.rem = dur;
              this.phase = 'decay';
            }
          } else if (this.phase === 'decay') {
            this.phase = this.mode === 'ad' ? 'idle' : 'sustain';
          } else if (this.phase === 'release') {
            this.phase = 'idle';
          }
        }
      }
      if (this.value < 0) this.value = 0; else if (this.value > 1) this.value = 1;
      out[i] = this.value;
    }
    if ((this._post = (this._post + 1) & 3) === 0) {
      this.port.postMessage({ t: 'state', s: { phase: this.phase, value: this.value, trig: this.trig } });
    }
    return true;
  }
}
registerProcessor('envelope-processor', EnvelopeProcessor);
`;

export class EnvelopeModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static PROCESSOR = "envelope-processor";
  static PROCESSOR_CODE = ENV_WORKLET_CODE;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static MODE = "adsr";

  constructor(ctx, params = {}) {
    super(ctx, params);
    this._postParam("mode", this.constructor.MODE);
  }

  // ── panel accessors (from the worklet snapshot — display only) ──
  getValue() { return this._state.value ?? 0; }
  getPhase() { return this._state.phase ?? "idle"; }
  getTrig()  { return this._state.trig ?? 0; }
}
