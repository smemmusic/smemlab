import { EnvelopeModule } from "../EnvelopeModule.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// ADSR envelope. Gate high → attack, decay to sustain, then hold; gate low →
// release. The CV-out value is normalised in dB space: 0 = release floor,
// 1 = peak (= 0 dB at the amp with the sustain knob at -48). All gate / ramp /
// CV plumbing lives in the shared EnvelopeModule worklet; this class only
// declares the knob set and selects the "adsr" segment behaviour.
export class AdsrEnvelopeModule extends EnvelopeModule {
  static MODE = "adsr";
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "s", kind: CONTROL_KIND.KNOB, range: [-48, 0],   curve: CONTROL_CURVE.LINEAR, cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];
}
