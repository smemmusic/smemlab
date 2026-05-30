import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Slow OscillatorNode whose ±1 output is scaled by a depth GainNode clamped
// to [0,1] so the CV output stays within the bipolar ±1 contract regardless
// of caller hygiene. Wire `cv` into any CV input.
export class LfoModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "cv", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR },
  ];
  static CONTROLS = [
    { name: "rate",  kind: CONTROL_KIND.KNOB,   range: [0.05, 30], curve: CONTROL_CURVE.EXP,
      cvRange: 20, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "depth", kind: CONTROL_KIND.KNOB,   range: [0, 1],     curve: CONTROL_CURVE.LINEAR,
      cvRange: 1,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "shape", kind: CONTROL_KIND.SWITCH, values: ["sine", "triangle", "square", "sawtooth"],
      cvRange: 1,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { rate, depth, shape }) {
    super(ctx);
    this.osc = ctx.createOscillator();
    this.osc.type = shape;
    this.osc.frequency.value = rate;
    this.depth = ctx.createGain();
    this.depth.gain.value = Math.max(0, Math.min(1, depth));
    this.osc.connect(this.depth);
    this._started = false;

    this._registerCvOut("cv", this.depth);
    this._makeCvInput("rate",  20, this.osc.frequency);
    this._makeCvInput("depth", 1,  null);
    this._makeSwitchInput("shape", ["sine", "triangle", "square", "sawtooth"], 1);
  }

  start() {
    if (this._started) return;
    this.osc.start();
    this._started = true;
  }

  setRate(hz) { this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.02); }
  setDepth(d) {
    const clamped = Math.max(0, Math.min(1, d));
    this.depth.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
  }
  setShape(s) { this.osc.type = s; }

  setParam(name, value) {
    if (name === "rate")       this.setRate(value);
    else if (name === "depth") this.setDepth(value);
    else if (name === "shape") this.setShape(value);
  }

  dispose() {
    try { this.osc.stop(); } catch {}
    try { this.osc.disconnect(); } catch {}
    try { this.depth.disconnect(); } catch {}
    super.dispose();
  }
}
