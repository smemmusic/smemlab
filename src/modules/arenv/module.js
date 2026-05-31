import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// AR envelope — a simplified ADSR with no decay and an implicit sustain
// at peak. Gate high → attack ramp 0 → peak, then hold; gate low →
// release ramp from current value → 0. Useful for plucks, claps, and
// percussive bursts where the sustain plateau is just "fully open".
//
// Mirrors EnvelopeModule's contract (cv-out shape, internal gain node for
// meter readout, gate-source dedup) so it composes with the same drawEnv +
// amp.level wiring as the ADSR envelope. The CV-out value uses the same
// dB-space normalisation: 0 = release floor, 1 = peak (= 0 dB at the amp
// with knob at -48).
export class ArEnvelopeModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, params) {
    super(ctx);
    this.params = { ...params };
    this.node = ctx.createGain();
    this.node.gain.value = 1;
    this.envPhase = "idle";
    this.envStart = 0;

    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 0;
    this.cvOut.start();
    this._gateSources = new Set();

    this._registerCvOut("env", this.cvOut);
    this._registerGateInput("trigger", (sourceId, active) => this._handleGate(sourceId, active));
    // Tapped so the envelope can sample the CV at note-on / note-off and
    // add its contribution to the scheduled ramps for that cycle.
    this._makeCvInput("a", 4, null, { tap: true });
    this._makeCvInput("r", 4, null, { tap: true });
  }

  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      r: Math.max(0.001, e.r + this.getCvLevel("r")),
    };
  }

  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  noteOn() {
    const t = this.ctx.currentTime;
    const e = this._effective();
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    // Attack to peak boost; then hold at peak (no decay, no sustain knob).
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);

    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(1.0, t + e.a);
    this.envStart = performance.now();
    // Reuse drawEnv's "ad" phase tag — with d=0 + s=0 it animates
    // the dot along the attack ramp and then across the flat top, which is
    // exactly the AR shape.
    this.envPhase = "ad";
  }
  noteOff() {
    const t = this.ctx.currentTime;
    const e = this._effective();
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(1.0, t + e.r);

    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(0, t + e.r);
    this.envStart = performance.now();
    this.envPhase = "rel";
  }
  reset() {
    const t = this.ctx.currentTime;
    this.node.gain.cancelScheduledValues(t);
    this.node.gain.setValueAtTime(1, t);
    this.cvOut.offset.cancelScheduledValues(t);
    this.cvOut.offset.setValueAtTime(0, t);
    this.envPhase = "idle";
    this._gateSources.clear();
  }

  _handleGate(sourceId, active) {
    const wasOpen = this._gateSources.size > 0;
    if (active) this._gateSources.add(sourceId);
    else        this._gateSources.delete(sourceId);
    const nowOpen = this._gateSources.size > 0;
    if (!wasOpen && nowOpen) this.noteOn();
    else if (wasOpen && !nowOpen) this.noteOff();
  }

  setParam(name, value) {
    if (name === "a" || name === "r") {
      this.setParams({ [name]: value });
    }
  }

  dispose() {
    try { this.cvOut.stop(); } catch {}
    try { this.cvOut.disconnect(); } catch {}
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}

