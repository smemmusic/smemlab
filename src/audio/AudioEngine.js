import { OscillatorModule } from "./modules/OscillatorModule.js";
import { FilterModule } from "./modules/FilterModule.js";
import { AmplifierModule } from "./modules/AmplifierModule.js";
import { EnvelopeModule } from "./modules/EnvelopeModule.js";
import { OutputModule } from "./modules/OutputModule.js";

// Singleton engine. No React, no Zustand, no DOM. Pure imperative API.
// AudioContext is created lazily inside start() — must be triggered by a user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.modules = null;
    this.blocks = { filter: false, amp: false, env: false };
    this.config = null;
  }

  isRunning() { return !!this.ctx && !!this.modules?.oscillator?._started; }

  start(config) {
    this.config = JSON.parse(JSON.stringify(config));
    this.blocks = { ...config.blocks };

    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } else if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    if (!this.modules) {
      this.modules = {
        oscillator: new OscillatorModule(this.ctx, config.osc),
        filter:     new FilterModule(this.ctx, config.flt),
        amp:        new AmplifierModule(this.ctx, { db: config.amp.db, active: this.blocks.amp }),
        env:        new EnvelopeModule(this.ctx, config.env),
        output:     new OutputModule(this.ctx, { vol: config.vol })
      };
    }

    this.modules.oscillator.start();
    this._connectGraph();
    this.modules.output.fadeIn(this.config.vol);
  }

  stop() {
    if (!this.ctx || !this.modules) return;
    this.modules.output.fadeOut();
    setTimeout(() => {
      try { this.modules.oscillator.dispose(); } catch {}
      this.modules.oscillator = new OscillatorModule(this.ctx, this.config.osc);
      // Re-wire so a future start() finds a clean source. _connectGraph runs at next start().
    }, 90);
  }

  dispose() {
    if (!this.ctx) return;
    try { Object.values(this.modules || {}).forEach((m) => m.dispose()); } catch {}
    try { this.ctx.close(); } catch {}
    this.ctx = null;
    this.modules = null;
  }

  // -------- imperative param setters (no-op if ctx not started)
  setOscType(type) { this.modules?.oscillator.setType(type); if (this.config) this.config.osc.type = type; }
  setOscFreq(hz)   { this.modules?.oscillator.setFreq(hz);  if (this.config) this.config.osc.freq = hz; }
  setCutoff(hz)    { this.modules?.filter.setCutoff(hz);    if (this.config) this.config.flt.cutoff = hz; }
  setQ(q)          { this.modules?.filter.setQ(q);          if (this.config) this.config.flt.q = q; }
  setAmpDb(db)     { this.modules?.amp.setDb(db);           if (this.config) this.config.amp.db = db; }
  setEnv(partial)  { this.modules?.env.setParams(partial);  if (this.config) Object.assign(this.config.env, partial); }
  setVol(v)        { this.modules?.output.setVol(v);        if (this.config) this.config.vol = v; }

  // -------- gating
  noteOn()  { if (this.blocks.env) this.modules?.env.noteOn(); }
  noteOff() { if (this.blocks.env) this.modules?.env.noteOff(); }

  // -------- topology
  addBlock(id) {
    if (!this.modules) { this.blocks[id] = true; return; }
    this.blocks[id] = true;
    if (id === "amp") this.modules.amp.setActive(true);
    this._connectGraph();
  }
  removeBlock(id) {
    if (!this.modules) { this.blocks[id] = false; return; }
    this.blocks[id] = false;
    if (id === "amp") this.modules.amp.setActive(false);
    if (id === "env") this.modules.env.reset();
    this._connectGraph();
  }

  // -------- read-only access for visualisers
  getAnalyser(name) {
    if (!this.modules) return null;
    if (name === "osc") return this.modules.oscillator.tap;
    if (name === "out") return this.modules.output.getAnalyser();
    return null;
  }
  getVcaValue()    { return this.modules?.env.getValue() ?? 1; }
  getEnvPhase()    { return this.modules?.env.getPhase() ?? "idle"; }
  getEnvStart()    { return this.modules?.env.getStart() ?? 0; }
  getFilterNode()  { return this.modules?.filter.getNode() ?? null; }

  // -------- private
  _connectGraph() {
    if (!this.modules) return;
    const { oscillator, filter, amp, env, output } = this.modules;
    // Disconnect everything (swallow errors — node may already be detached)
    try { oscillator.node.disconnect(); } catch {}
    try { oscillator.tap.disconnect();  } catch {}
    try { filter.node.disconnect();     } catch {}
    try { env.node.disconnect();        } catch {}
    try { amp.node.disconnect();        } catch {}

    // Always: osc → tap (so the oscilloscope works pre-everything)
    oscillator.node.connect(oscillator.tap);

    // Then: tap → [filter?] → env → amp → outTap
    let node = oscillator.tap;
    if (this.blocks.filter) {
      node.connect(filter.node);
      node = filter.node;
    }
    node.connect(env.node);
    env.node.connect(amp.node);
    amp.node.connect(output.input);
  }
}
