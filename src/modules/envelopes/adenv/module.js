import { EnvelopeModule } from "../EnvelopeModule.js";
import { CONTROL_KIND, CONTROL_CURVE, CV_POLARITY } from "../../../audio/graph/types.js";

// AD envelope — percussive, one-shot. A gate rising edge starts an attack-then-
// decay cycle of fixed length (a + d); gate length is otherwise ignored ("ad"
// mode skips the release on gate-low). Re-triggering during a running cycle
// restarts the attack from the current value (no click). Same dB-space CV-out
// contract as ADSR/AR: 0 = silence, 1 = peak.
export class AdEnvelopeModule extends EnvelopeModule {
  static MODE = "ad";
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];
}
