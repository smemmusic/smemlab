import { AudioModule } from "./AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

// Low-frequency oscillator: a slow OscillatorNode whose ±1 output is scaled by
// a depth GainNode (in Hz). Wire `output` into any AudioParam — Web Audio adds
// the signal to the param's intrinsic value, so the param swings ±depth around
// whatever the knob is set to.
//
// Lifecycle is short-lived: OscillatorNodes can only be start()'d once, so
// each time the LFO block is connected the engine builds a new LfoModule and
// disposes it on disconnect.
export class LfoModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "cv", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR },
  ];
  static CONTROLS = [
    { name: "rate",  kind: CONTROL_KIND.KNOB,   range: [0.05, 30], curve: CONTROL_CURVE.EXP,
      cvRange: 20, cvPolarity: CV_POLARITY.UNIPOLAR },
    // depth: post-normalisation attenuator. CV output still clamps to ±1.
    { name: "depth", kind: CONTROL_KIND.KNOB,   range: [0, 1],     curve: CONTROL_CURVE.LINEAR,
      cvRange: 1,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "shape", kind: CONTROL_KIND.SWITCH, values: ["sine", "triangle", "square", "sawtooth"],
      cvRange: 1,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { rate, depth, shape }) {
    super(ctx);
    this.osc   = ctx.createOscillator();
    this.osc.type = shape;
    this.osc.frequency.value = rate;
    this.depth = ctx.createGain();
    this.depth.gain.value = depth;
    this.osc.connect(this.depth);
    this._started = false;
  }
  get input()  { return null; }
  get output() { return this.depth; }   // depth gain is the LFO's send

  start() {
    if (this._started) return;
    this.osc.start();
    this._started = true;
  }
  setRate(hz)  { this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.02); }
  setDepth(d)  { this.depth.gain.setTargetAtTime(d, this.ctx.currentTime, 0.02); }
  setShape(s)  { this.osc.type = s; }

  dispose() {
    try { this.osc.stop(); } catch {}
    try { this.osc.disconnect(); } catch {}
    try { this.depth.disconnect(); } catch {}
  }
}
