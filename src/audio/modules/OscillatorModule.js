import { AudioModule } from "./AudioModule.js";

// Source module: oscillator → pre-everything analyser tap.
// `output` exposes the tap so the engine can both visualise the raw signal
// and feed it onward through the chain.
export class OscillatorModule extends AudioModule {
  constructor(ctx, { type, freq }) {
    super(ctx);
    this.node = ctx.createOscillator();
    this.node.type = type;
    this.node.frequency.value = freq;
    this.tap = ctx.createAnalyser();
    this.tap.fftSize = 2048;
    this.node.connect(this.tap);
    this._started = false;
  }
  get input()  { return null; }
  get output() { return this.tap; }

  start() {
    if (this._started) return;
    this.node.start();
    this._started = true;
  }
  setType(t) { this.node.type = t; }
  setFreq(f) { this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); }
  dispose() {
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    try { this.tap.disconnect(); } catch {}
  }
}
