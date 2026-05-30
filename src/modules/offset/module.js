import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Constant unipolar CV source. One knob, one output: the knob's value (0..1)
// is emitted as a steady DC voltage. Internally a single ConstantSourceNode
// whose `offset` tracks the knob serves as the CV output directly.
export class OffsetModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [
    // Knob only — no auto-CV-input port (spec is a pure source).
    { name: "value", kind: CONTROL_KIND.KNOB, range: [0, 1], curve: CONTROL_CURVE.LINEAR,
      cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
  ];

  constructor(ctx, { value = 0 } = {}) {
    super(ctx);
    this.node = ctx.createConstantSource();
    this.node.offset.value = value;
    this.node.start();
    this._registerCvOut("out", this.node);
  }

  setParam(name, value) {
    if (name === "value") this.node.offset.setTargetAtTime(value, this.ctx.currentTime, 0.01);
  }

  dispose() {
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
