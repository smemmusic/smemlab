import { AudioModule } from "./AudioModule.js";
import { volToGain } from "../constants.js";

// Final stage: outTap → master gain → soft-clip shaper → destination.
// Exposes outTap as `input` so upstream modules connect to it.
export class OutputModule extends AudioModule {
  constructor(ctx, { vol }) {
    super(ctx);
    this.outTap = ctx.createAnalyser();
    this.outTap.fftSize = 2048;
    this.master = ctx.createGain();
    this.master.gain.value = volToGain(vol);

    this.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6);
    }
    this.shaper.curve = curve;
    this.shaper.oversample = "4x";

    this.outTap.connect(this.master);
    this.master.connect(this.shaper);
    this.shaper.connect(ctx.destination);
  }
  get input()  { return this.outTap; }
  get output() { return this.shaper; }

  setVol(v) { this.master.gain.setTargetAtTime(volToGain(v), this.ctx.currentTime, 0.02); }

  fadeOut() {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  }
  fadeIn(vol) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(0.0001, t);
    this.master.gain.exponentialRampToValueAtTime(Math.max(0.0002, volToGain(vol)), t + 0.04);
  }
  getAnalyser() { return this.outTap; }
  dispose() {
    try { this.outTap.disconnect(); } catch {}
    try { this.master.disconnect(); } catch {}
    try { this.shaper.disconnect(); } catch {}
  }
}
