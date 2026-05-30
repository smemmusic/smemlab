import { AudioModule } from "./AudioModule.js";
import { dbToLin } from "../constants.js";

// Manual gain stage. When the amp block is inactive, the gain stays at 1 (0 dB pass-through).
export class AmplifierModule extends AudioModule {
  constructor(ctx, { db, active }) {
    super(ctx);
    this.node = ctx.createGain();
    this.active = active;
    this.db = db;
    this.node.gain.value = active ? dbToLin(db) : 1;
  }
  get input()  { return this.node; }
  get output() { return this.node; }

  setActive(active) {
    this.active = active;
    this.node.gain.setTargetAtTime(active ? dbToLin(this.db) : 1, this.ctx.currentTime, 0.01);
  }
  setDb(db) {
    this.db = db;
    if (this.active) this.node.gain.setTargetAtTime(dbToLin(db), this.ctx.currentTime, 0.01);
  }
  dispose() { try { this.node.disconnect(); } catch {} }
}
