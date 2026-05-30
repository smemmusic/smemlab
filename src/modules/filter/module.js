import { AudioModule } from "../../audio/AudioModule.js";
import { CUTOFF_MOD_RANGE_HZ } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Biquad filter with audio in/out and CV inputs for cutoff, resonance, and
// mode (quantised switch). Cutoff and resonance taps feed the panel's live
// frequency response curve.
export class FilterModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "input",  dir: PORT_DIR.IN,  type: PORT_TYPE.AUDIO },
    { name: "output", dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    { name: "cutoff",    kind: CONTROL_KIND.KNOB,   range: [20, 20000], curve: CONTROL_CURVE.EXP,
      cvRange: CUTOFF_MOD_RANGE_HZ, cvPolarity: CV_POLARITY.BIPOLAR },
    { name: "resonance", kind: CONTROL_KIND.KNOB,   range: [0.1, 24],   curve: CONTROL_CURVE.LINEAR,
      cvRange: 12, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "mode",      kind: CONTROL_KIND.SWITCH, values: ["lowpass", "highpass", "bandpass", "notch"],
      cvRange: 1, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { cutoff, resonance, mode = "lowpass" }) {
    super(ctx);
    this.node = ctx.createBiquadFilter();
    this.node.type = mode;
    this.node.frequency.value = cutoff;
    this.node.Q.value = resonance;

    this._registerAudioIn("input",   this.node);
    this._registerAudioOut("output", this.node);
    // Tapped CV inputs so the panel can read post-mix cutoff/resonance for the
    // live response curve. Multiple sources sum at each scaler.
    this._makeCvInput("cutoff",    CUTOFF_MOD_RANGE_HZ, this.node.frequency, { tap: true });
    this._makeCvInput("resonance", 12, this.node.Q, { tap: true });
    this._makeSwitchInput("mode", ["lowpass", "highpass", "bandpass", "notch"], 1);
  }

  setCutoff(f)    { this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); }
  setResonance(q) { this.node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01); }
  setMode(m)      { this.node.type = m; }
  getNode()       { return this.node; }

  setParam(name, value) {
    if (name === "cutoff")         this.setCutoff(value);
    else if (name === "resonance") this.setResonance(value);
    else if (name === "mode")      this.setMode(value);
  }

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
