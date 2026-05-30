import { AudioModule } from "./AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
} from "../graph/types.js";

// Phase inverter / signal-negate utility. One CV in, one CV out. The output
// is the input multiplied by -1, so a +1 V input becomes -1 V at the output
// and vice versa. Classic use: mirror an LFO so two destinations sweep in
// opposite directions, or invert an envelope so a CV input fades up while
// the source ramps down.
//
// Implementation: a single GainNode with gain.value = -1 sits in the signal
// path. Sources connect into its input; the same node is the output port.
// Because there's no scaler stage, the output amplitude equals -input
// (passes the CV normalisation contract through unchanged).
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

    // Register the same GainNode as both the CV input scaler and the CV output.
    // Sources connect into node (CV input). Destinations connect from node (CV
    // output, already inverted). Skip _makeCvInput because we don't want a
    // separate scaler — gain = -1 IS the operation.
    this._cvPorts.in.in = { scaler: this.node, range: -1, target: null };
    this._registerCvOut("out", this.node);
  }

  setParam() { /* no params */ }

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
