import { AudioModule } from "../../audio/AudioModule.js";
import { volToGain } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Final stage: outTap → master gain → soft-clip shaper → destination.
export class OutputModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "input", dir: PORT_DIR.IN, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    { name: "vol", kind: CONTROL_KIND.KNOB, range: [0, 100], curve: CONTROL_CURVE.LINEAR,
      cvRange: 100, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { vol }) {
    super(ctx);
    // `inputNode` is the registered audio in; `outTap` is a side-branch the
    // engine disconnects when visuals are off without silencing the chain.
    this.inputNode = ctx.createGain();
    this.inputNode.gain.value = 1;
    this.outTap = ctx.createAnalyser();
    this.outTap.fftSize = 2048;
    this.master = ctx.createGain();
    // Remember the intended master gain so fadeIn() can restore it after a
    // fadeOut() (power-cycle) without needing the vol value pushed again.
    this.targetGain = volToGain(vol);
    this.master.gain.value = this.targetGain;

    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6);
    }
    this.shaper.curve = curve;
    this.shaper.oversample = "4x";

    this.inputNode.connect(this.master);
    this.inputNode.connect(this.outTap);
    this.master.connect(this.shaper);
    this.shaper.connect(ctx.destination);

    this._registerAudioIn("input", this.inputNode);
    this._registerDisplayTap(this.inputNode, this.outTap);
    // CV in "vol" — additive modulation on master gain.
    this._makeCvInput("vol", 1, this.master.gain);
  }

  setVol(v) {
    this.targetGain = volToGain(v);
    this.master.gain.setTargetAtTime(this.targetGain, this.ctx.currentTime, 0.02);
  }

  setParam(name, value) {
    if (name === "vol") this.setVol(value);
  }

  // De-click ramp before the context is suspended (power off).
  fadeOut() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  }
  // Ramp back to the remembered target after the context resumes (power on).
  fadeIn() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.targetGain), t + 0.04);
  }
  getAnalyser() { return this.outTap; }

  dispose() {
    try { this.inputNode.disconnect(); } catch {}
    try { this.outTap.disconnect(); } catch {}
    try { this.master.disconnect(); } catch {}
    try { this.shaper.disconnect(); } catch {}
    super.dispose();
  }
}
