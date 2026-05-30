import { AudioModule } from "./AudioModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../constants.js";

// VCA module gated by an ADSR. Idle gain = 1 (0 dB) so the amp's offset passes through.
// noteOn ramps to a peak at ENV_PEAK_BOOST_DB above amp, decays to peak+sustainDb,
// noteOff releases back to idle (1.0).
export class EnvelopeModule extends AudioModule {
  constructor(ctx, params) {
    super(ctx);
    this.params = { ...params };       // { a, d, sustainDb, r }
    this.node = ctx.createGain();
    this.node.gain.value = 1;
    this.envPhase = "idle";
    this.envStart = 0;
  }
  get input()  { return this.node; }
  get output() { return this.node; }

  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  noteOn() {
    const t = this.ctx.currentTime;
    const e = this.params;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB + e.sustainDb), t + e.a + e.d);
    this.envStart = performance.now();
    this.envPhase = "ad";
  }
  noteOff() {
    const t = this.ctx.currentTime;
    const e = this.params;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(1.0, t + e.r);
    this.envStart = performance.now();
    this.envPhase = "rel";
  }
  reset() {
    const t = this.ctx.currentTime;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    this.envPhase = "idle";
  }
  dispose() { try { this.node.disconnect(); } catch {} }
}
