import { EnvelopeModule } from "../EnvelopeModule.js";
import { DB_FLOOR, dbToLin, ENV_PEAK_BOOST_DB } from "../../../audio/constants.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// ADSR envelope. Gate high → attack, decay to sustain, then hold; gate low →
// release. The CV-out value is normalised in dB space: 0 = release floor,
// 1 = peak (= 0 dB at the amp with the sustain knob at -48). The shared gate /
// CV / meter plumbing lives in EnvelopeModule.
export class AdsrEnvelopeModule extends EnvelopeModule {
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "s", kind: CONTROL_KIND.KNOB, range: [-48, 0],   curve: CONTROL_CURVE.LINEAR, cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  // Backward compat: patches saved before the rename stored the sustain value
  // under `sustainDb`. Map it forward both at construction and on live setParam
  // so old patch files / unmigrated store entries still load.
  _migrateParams(p) {
    if (p.sustainDb !== undefined && p.s === undefined) p.s = p.sustainDb;
    delete p.sustainDb;
    return p;
  }
  _aliasParam(name) { return name === "sustainDb" ? "s" : name; }

  // Sum each ADSR knob with its CV-input contribution and clamp to the knob
  // ranges. CV inputs are unipolar so they can only push parameters upward —
  // longer a/d/r, less-negative (louder) sustain.
  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      d: Math.max(0.001, e.d + this.getCvLevel("d")),
      s: Math.max(DB_FLOOR, Math.min(0, e.s + this.getCvLevel("s"))),
      r: Math.max(0.001, e.r + this.getCvLevel("r")),
    };
  }

  _onGateOpen() {
    const t = this.ctx.currentTime;
    const e = this._effective();
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB + e.s), t + e.a + e.d);
    const cv = this.cvOut.offset;
    // s (sustain) lives in [DB_FLOOR, 0] dB; map to a normalised [0, 1]
    // position in dB space so a downstream dB-CV input (e.g. amp's
    // `cv × CV_MAX_DB`, where CV_MAX_DB matches |DB_FLOOR|) lands at the
    // envelope's intended sustain dB at the destination. Using dbToLin here
    // was the old bug: it produced a linear-amplitude value that the amp
    // then re-scaled as if it were dB, giving e.g. sustain −3 dB → −14 dB.
    const sustainNorm = (e.s - DB_FLOOR) / -DB_FLOOR;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(1.0, t + e.a);
    cv.linearRampToValueAtTime(sustainNorm, t + e.a + e.d);
    this.envStart = performance.now();
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
