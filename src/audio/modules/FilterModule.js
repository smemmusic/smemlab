import { AudioModule } from "./AudioModule.js";
import { CUTOFF_MOD_RANGE_HZ } from "../constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

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

  constructor(ctx, { cutoff, q, mode = "lowpass" }) {
    super(ctx);
    this.node = ctx.createBiquadFilter();
    this.node.type = mode;
    this.node.frequency.value = cutoff;
    this.node.Q.value = q;

    // Modulation input. Any source (e.g. an LFO) connects here and emits a
    // normalised ±1 signal scaled by its own depth; this gain stage scales
    // that into Hz before adding to the cutoff AudioParam. Owning the
    // Hz-scaling here keeps the LFO destination-agnostic.
    this.cutoffMod = ctx.createGain();
    this.cutoffMod.gain.value = CUTOFF_MOD_RANGE_HZ;
    this.cutoffMod.connect(this.node.frequency);
  }
  get input()  { return this.node; }
  get output() { return this.node; }
  get cutoffModInput() { return this.cutoffMod; }   // where modulators patch in

  setCutoff(f) { this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); }
  setQ(q)      { this.node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01); }
  setMode(m)   { this.node.type = m; }
  getNode()    { return this.node; }
  dispose() {
    try { this.cutoffMod.disconnect(); } catch {}
    try { this.node.disconnect(); } catch {}
  }
}
