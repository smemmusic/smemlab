import { AudioModule } from "./AudioModule.js";

export class FilterModule extends AudioModule {
  constructor(ctx, { cutoff, q }) {
    super(ctx);
    this.node = ctx.createBiquadFilter();
    this.node.type = "lowpass";
    this.node.frequency.value = cutoff;
    this.node.Q.value = q;
  }
  get input()  { return this.node; }
  get output() { return this.node; }

  setCutoff(f) { this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); }
  setQ(q)      { this.node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01); }
  getNode()    { return this.node; }   // used by FilterPanel for getFrequencyResponse
  dispose()    { try { this.node.disconnect(); } catch {} }
}
