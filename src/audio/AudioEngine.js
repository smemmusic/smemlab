import { OscillatorModule } from "./modules/OscillatorModule.js";
import { FilterModule } from "./modules/FilterModule.js";
import { AmplifierModule } from "./modules/AmplifierModule.js";
import { EnvelopeModule } from "./modules/EnvelopeModule.js";
import { OutputModule } from "./modules/OutputModule.js";
import { LfoModule } from "./modules/LfoModule.js";

// Singleton engine. No React, no Zustand, no DOM. Pure imperative API.
// AudioContext is created lazily inside start() — must be triggered by a user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.modules = null;
    this.lfo = null;                                       // short-lived: (re)created on _connectLfo
    this.blocks = { filter: false, amp: false, env: false, lfo: false };
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
    this._connectLfo();
    this.modules.output.fadeIn(this.config.vol);
  }

  stop() {
    if (!this.ctx || !this.modules) return;
    this.modules.output.fadeOut();
    this._disconnectLfo();
    setTimeout(() => {
      try { this.modules.oscillator.dispose(); } catch {}
      this.modules.oscillator = new OscillatorModule(this.ctx, this.config.osc);
      // Re-wire so a future start() finds a clean source. _connectGraph runs at next start().
    }, 90);
  }

  dispose() {
    if (!this.ctx) return;
    this._disconnectLfo();
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
  setFilterMode(m) { this.modules?.filter.setMode(m);       if (this.config) this.config.flt.mode = m; }
  setAmpDb(db)     { this.modules?.amp.setDb(db);           if (this.config) this.config.amp.db = db; }
  setEnv(partial)  { this.modules?.env.setParams(partial);  if (this.config) Object.assign(this.config.env, partial); }
  setVol(v)        { this.modules?.output.setVol(v);        if (this.config) this.config.vol = v; }

  setLfo(partial) {
    if (this.config) {
      if (!this.config.lfo) this.config.lfo = {};
      Object.assign(this.config.lfo, partial);
    }
    if (!this.lfo) return;
    if (partial.rate  != null) this.lfo.setRate(partial.rate);
    if (partial.depth != null) this.lfo.setDepth(partial.depth);
    if (partial.shape != null) this.lfo.setShape(partial.shape);
  }

  // -------- gating
  noteOn()  { if (this.blocks.env) this.modules?.env.noteOn(); }
  noteOff() { if (this.blocks.env) this.modules?.env.noteOff(); }

  // -------- topology
  addBlock(id) {
    if (!this.modules) { this.blocks[id] = true; return; }
    this.blocks[id] = true;
    if (id === "amp") this.modules.amp.setActive(true);
    if (id === "lfo" || id === "filter") this._connectLfo();
    if (id !== "lfo") this._connectGraph();
  }
  removeBlock(id) {
    if (!this.modules) { this.blocks[id] = false; return; }
    this.blocks[id] = false;
    if (id === "amp") this.modules.amp.setActive(false);
    if (id === "env") this.modules.env.reset();
    // LFO has no target once filter is gone — tear it down.
    if (id === "lfo" || id === "filter") this._disconnectLfo();
    if (id !== "lfo") this._connectGraph();
    // Re-evaluate LFO patch in case removing one block exposed/closed its target.
    if (id !== "lfo") this._connectLfo();
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

  // LFO is a side-chain — built fresh each connect, torn down on disconnect.
  // The LFO emits a normalised ±depth signal; the filter's cutoffModInput
  // (a GainNode with gain = CUTOFF_MOD_RANGE_HZ) scales it to Hz before it
  // reaches the BiquadFilter's frequency AudioParam.
  _connectLfo() {
    if (!this.modules) return;
    this._disconnectLfo();
    if (!(this.blocks.lfo && this.blocks.filter)) return;
    const cfg = this.config?.lfo || { rate: 5, depth: 0.4, shape: "sine" };
    this.lfo = new LfoModule(this.ctx, cfg);
    this.lfo.output.connect(this.modules.filter.cutoffModInput);
    this.lfo.start();
  }
  _disconnectLfo() {
    if (this.lfo) {
      try { this.lfo.dispose(); } catch {}
      this.lfo = null;
    }
  }
}
