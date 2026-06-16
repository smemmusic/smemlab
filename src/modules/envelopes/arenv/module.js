import { EnvelopeModule } from "../EnvelopeModule.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// AR envelope — a simplified ADSR with no decay and an implicit sustain at peak.
// Gate high → attack ramp 0 → peak, then hold; gate low → release ramp from the
// current value → 0. Useful for plucks, claps, and percussive bursts. Shares the
// EnvelopeModule worklet; "ar" mode holds at peak after the attack and releases
// on gate-low (0 = release floor, 1 = peak).
export class ArEnvelopeModule extends EnvelopeModule {
  static MODE = "ar";
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];
}
