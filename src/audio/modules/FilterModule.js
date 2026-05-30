import { AudioModule } from "./AudioModule.js";
import { CUTOFF_MOD_RANGE_HZ } from "../constants.js";

export class FilterModule extends AudioModule {
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
