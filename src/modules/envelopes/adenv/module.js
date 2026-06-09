import { EnvelopeModule } from "../EnvelopeModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../../../audio/constants.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// AD envelope — percussive, one-shot. A gate rising edge starts an attack-then-
// decay cycle of fixed length (a + d); gate length is otherwise ignored, so
// _onGateClose is the inherited no-op (that's the whole point of "no sustain").
// Re-triggering during a running cycle restarts from the current value (no
// click). Same dB-space CV-out contract as ADSR/AR: 0 = silence, 1 = peak.
export class AdEnvelopeModule extends EnvelopeModule {
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      d: Math.max(0.001, e.d + this.getCvLevel("d")),
    };
  }

  // Schedule the whole A→D cycle in one shot on the gate's rising edge.
  _onGateOpen() {
    const t = this.ctx.currentTime;
    const e = this._effective();

    // Internal gain (meter readout): boost to peak then back to unity.
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(1.0,                        t + e.a + e.d);

    // CV-out: 0 → peak (attack), then peak → 0 (decay).
    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(1.0, t + e.a);
    cv.linearRampToValueAtTime(0,   t + e.a + e.d);

    this.envStart = performance.now();
    this.envPhase = "ad";
  }
}
