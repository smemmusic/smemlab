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
    // depth is a post-normalisation attenuator clamped to [0,1] so the CV
    // output respects the ±1 bipolar contract regardless of caller hygiene.
    this.depth = ctx.createGain();
    this.depth.gain.value = Math.max(0, Math.min(1, depth));
    this.osc.connect(this.depth);
    this._started = false;

    // ---- typed-port registration ----
    // CV out "cv" — the attenuated oscillator signal, bipolar in [-1, +1].
    this._registerCvOut("cv", this.depth);
    // CV inputs for knobs. Rate accepts modulation (LFO-on-LFO is fine);
    // depth and shape are deferred (depth modulation would need its own
    // attenuator stage; shape is discrete).
    this._makeCvInput("rate",  20, this.osc.frequency);
    this._makeCvInput("depth", 1,  null);
    // CV in "shape" — quantised to one of the LFO waveform types.
    this._makeSwitchInput("shape", ["sine", "triangle", "square", "sawtooth"], 1);
  }
  get input()  { return null; }
  get output() { return this.depth; }   // depth gain is the LFO's send (legacy)

  start() {
    if (this._started) return;
    this.osc.start();
    this._started = true;
  }
  setRate(hz)  { this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.02); }
  setDepth(d)  {
    const clamped = Math.max(0, Math.min(1, d));
    this.depth.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
  }
  setShape(s)  { this.osc.type = s; }

  // ---- typed-port setParam dispatch ----
  setParam(name, value) {
    if (name === "rate")  this.setRate(value);
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
