import { WorkletModule } from "../../audio/WorkletModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// 0..11 — the twelve semitone roots.
const ROOT_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Pitch quantizer. Reads an incoming CV (0..1) and snaps it to the nearest note
// of a chosen scale, emitting a V/oct pitch (1 V = 1 octave = 12 semitones).
// The 0..1 input is mapped across `range` semitones, rounded to a scale degree,
// then converted to volts on the `out` pitch port. The read-quantise-write runs
// in an AudioWorkletProcessor on the audio thread (a short output slew keeps
// step hand-offs click-free). `range` is an AudioParam; `scale`/`root` are sent
// as messages. (The legacy CV-driven `root` switch was dropped — root is set by
// its stepper.)
const QUANT_WORKLET_CODE = `
const SCALES = {
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
};
function snapToScale(semi, scaleName) {
  const degrees = SCALES[scaleName] || SCALES.chromatic;
  const oct = Math.floor(semi / 12);
  const within = semi - oct * 12;
  let best = oct * 12 + degrees[0];
  let bestDist = Infinity;
  for (const o of [oct, oct + 1]) {
    for (const d of degrees) {
      const note = o * 12 + d;
      const dist = Math.abs(note - (oct * 12 + within));
      if (dist < bestDist) { bestDist = dist; best = note; }
    }
  }
  return best;
}
class QuantizerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'range', defaultValue: 24, minValue: 1, maxValue: 48, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.scale = 'major';
    this.root = 0;
    this.out = 0;
    this.note = 0;
    this._post = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.t === 'param') {
        if (d.name === 'scale') this.scale = d.value;
        else if (d.name === 'root') this.root = d.value;
      }
    };
  }
  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    const len = out.length;
    const inp = inputs[0] && inputs[0][0];
    const k = 1 - Math.exp(-1 / (0.006 * sampleRate));
    if (inp) {
      const range = parameters.range[0];
      let cv = inp[0]; if (cv < 0) cv = 0; else if (cv > 1) cv = 1;  // near-DC step
      const semi = snapToScale(Math.round(cv * range) - this.root, this.scale) + this.root;
      this.note = semi;
      const target = semi / 12;
      for (let i = 0; i < len; i++) { this.out += (target - this.out) * k; out[i] = this.out; }
    } else {
      for (let i = 0; i < len; i++) out[i] = this.out;  // hold last when unwired
    }
    if ((this._post = (this._post + 1) & 7) === 0) {
      this.port.postMessage({ t: 'state', s: { note: this.note } });
    }
    return true;
  }
}
registerProcessor('quantizer-processor', QuantizerProcessor);
`;

export class QuantizerModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static PROCESSOR = "quantizer-processor";
  static PROCESSOR_CODE = QUANT_WORKLET_CODE;
  static PORTS = [
    { name: "in",  dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.PITCH },
  ];
  static CONTROLS = [
    { name: "range", kind: CONTROL_KIND.KNOB,   range: [12, 36], curve: CONTROL_CURVE.LINEAR, cvInput: false },
    { name: "root",  kind: CONTROL_KIND.SWITCH, values: ROOT_VALUES, cvInput: false,
      description: "scale root (0 → C, 11 → B)" },
    { name: "scale", kind: CONTROL_KIND.SWITCH, values: ["chromatic", "major", "minor", "pentatonic"], cvInput: false },
  ];

  constructor(ctx, params = {}) {
    super(ctx, params);  // range → param; scale/root → messages (auto-sent)
  }

  getNote() { return this._state.note ?? 0; }
}
