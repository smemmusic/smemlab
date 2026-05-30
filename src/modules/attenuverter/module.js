import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Bipolar attenuator. One CV in, one CV out, one knob:
//   amount = -1  → invert at full magnitude
//   amount =  0  → fully attenuated (silent)
//   amount = +1  → pass through at full magnitude
// Single GainNode with `gain.value = amount` does it all in one node, so the
// same node serves as both the CV-input scaler and the CV-output (same trick
// as the inverter module).
export class AttenuverterModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "in",  dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR },
  ];
  static CONTROLS = [
    // Knob only — no auto-CV-input port (spec is strictly one in / one out).
    { name: "amount", kind: CONTROL_KIND.KNOB, range: [-1, 1], curve: CONTROL_CURVE.LINEAR,
      cvPolarity: CV_POLARITY.BIPOLAR, cvInput: false },
  ];

  constructor(ctx, { amount = 0 } = {}) {
    super(ctx);
    this.node = ctx.createGain();
    this.node.gain.value = amount;
    this._cvPorts.in.in = { scaler: this.node, range: amount, target: null };
    this._registerCvOut("out", this.node);
  }

  setParam(name, value) {
    if (name === "amount") this.node.gain.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
