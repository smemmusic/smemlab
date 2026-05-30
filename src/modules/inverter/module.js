import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
} from "../../audio/graph/types.js";

// Phase inverter / signal-negate utility. One CV in, one CV out. Output is
// input × -1: +1 V in → -1 V out. Single GainNode with gain.value = -1; the
// same node is both the CV input scaler and the CV output, so the inversion
// happens in place without a separate scaler stage.
export class InverterModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "in",  dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.node = ctx.createGain();
    this.node.gain.value = -1;
    this._cvPorts.in.in = { scaler: this.node, range: -1, target: null };
    this._registerCvOut("out", this.node);
  }

  setParam() {}

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
