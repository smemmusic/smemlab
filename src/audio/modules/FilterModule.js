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

    // Legacy direct cutoff modulation scaler (used by the old AudioEngine's
    // _connectLfo path via the cutoffModInput getter). Kept until the engine
    // flip in step 3.
    this.cutoffMod = ctx.createGain();
    this.cutoffMod.gain.value = CUTOFF_MOD_RANGE_HZ;
    this.cutoffMod.connect(this.node.frequency);

    // ---- typed-port registration ----
    // Audio in/out: BiquadFilter is read/write on the same node.
    this._registerAudioIn("input",   this.node);
    this._registerAudioOut("output", this.node);
    // CV in "cutoff" — new scaler that *also* lands on node.frequency. Web
    // Audio sums multiple sources at the AudioParam, so coexisting with the
    // legacy cutoffMod scaler is fine — neither sees the other. Tapped so the
    // panel response curve can show the post-CV cutoff.
    this._makeCvInput("cutoff",    CUTOFF_MOD_RANGE_HZ, this.node.frequency, { tap: true });
    // CV in "resonance" — unipolar 0..1 swings Q by ±12 (i.e. roughly the
    // full BiquadFilter Q range). Tapped for the same reason.
    this._makeCvInput("resonance", 12, this.node.Q, { tap: true });
    // CV in "mode" — dangling scaler. Switch quantization is deferred; the
    // port exists so connections succeed.
    this._makeCvInput("mode", 1, null);
  }
  get input()  { return this.node; }
  get output() { return this.node; }
  get cutoffModInput() { return this.cutoffMod; }   // legacy modulators patch in here

  setCutoff(f) { this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); }
  setQ(q)      { this.node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01); }
  setMode(m)   { this.node.type = m; }
  getNode()    { return this.node; }

  // ---- typed-port setParam dispatch ----
  // Accepts both the typed-port CV-input name ("resonance") and the legacy
  // store slot key ("q"). Same compatibility tactic as AmplifierModule.
  setParam(name, value) {
    if (name === "cutoff")    this.setCutoff(value);
    else if (name === "resonance" || name === "q") this.setQ(value);
    else if (name === "mode") this.setMode(value);
  }

  dispose() {
    try { this.cutoffMod.disconnect(); } catch {}
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
