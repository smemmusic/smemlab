import { EnvelopeModule } from "../EnvelopeModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../../../audio/constants.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// AR envelope — a simplified ADSR with no decay and an implicit sustain at
// peak. Gate high → attack ramp 0 → peak, then hold; gate low → release ramp
// from current value → 0. Useful for plucks, claps, and percussive bursts
// where the sustain plateau is just "fully open". Shares EnvelopeModule's
// cv-out / meter / gate plumbing, so it composes with the same drawEnv +
// amp.level wiring as the ADSR envelope (0 = release floor, 1 = peak).
export class ArEnvelopeModule extends EnvelopeModule {
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      r: Math.max(0.001, e.r + this.getCvLevel("r")),
    };
  }

  _onGateOpen() {
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
    // Reuse drawEnv's "ad" phase tag — with d=0 + s=0 it animates the dot
    // along the attack ramp and then across the flat top, the AR shape.
    this.envPhase = "ad";
  }

  _onGateClose() {
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
}
