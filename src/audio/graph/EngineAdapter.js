// Drop-in replacement for the legacy AudioEngine. Exposes the exact same
// public API (start/stop/setOscType/setCutoff/.../noteOn/noteOff/addBlock/...)
// but internally drives the typed-port GraphEngine.
//
// Why an adapter rather than a direct rewrite of all callers?
//   - Panels, the bridge, Transport, and visualisers all use the legacy API.
//   - Step 4 will replace those callers with instance-aware code; until then,
//     this adapter keeps the working synth working while we swap engines.
//   - The adapter maintains a stable mapping from legacy "slot" names
//     (`osc`, `filter`, `amp`, `env`, `lfo`, `output`) to per-slot
//     GraphEngine module IDs.
//
// What's intentionally NOT delegated to graph routing yet:
//   - Gates. Keyboard and Gate panels currently call engine.noteOn/noteOff
//     directly. Until Keyboard/Gate become real modules (step 5), the adapter
//     forwards directly to env.onGate("trigger", sourceId, active). The
//     env module's _gateSources Set then takes care of multi-source logic
//     exactly as the old `gateSources` map did at the store layer.

import { GraphEngine } from "./GraphEngine.js";

export class EngineAdapter {
  constructor() {
    this.graph = new GraphEngine();
    this.config = null;
    this.blocks = { filter: false, amp: false, env: false, lfo: false, keyboard: false, gate: false };
    // Slot → GraphEngine module ID. Some slots (keyboard, gate) are UI-only
    // and have no module; their entry stays null.
    this.ids = { osc: null, filter: null, amp: null, env: null, lfo: null, output: null };
  }

  // ---- Lifecycle ----

  isRunning() { return this.graph.isRunning(); }

  start(config) {
    this.config = JSON.parse(JSON.stringify(config));
    this.blocks = { ...this.config.blocks };

    if (!this.graph.ctx) {
      this.graph.start();
    } else {
      this.graph.start(); // resume if suspended
    }

    // Build the canonical slots from current config + blocks. Always: osc + output.
    if (!this.ids.osc) {
      this.ids.osc = this.graph.addModule({ type: "oscillator", params: { type: this.config.osc.type, freq: this.config.osc.freq } });
    } else {
      this.graph.getModule(this.ids.osc)?.start?.();
    }
    if (!this.ids.output) {
      this.ids.output = this.graph.addModule({ type: "output", params: { vol: this.config.vol } });
    }
    if (this.blocks.filter && !this.ids.filter) {
      this.ids.filter = this.graph.addModule({ type: "filter", params: { cutoff: this.config.flt.cutoff, q: this.config.flt.q, mode: this.config.flt.mode } });
    }
    if (this.blocks.amp && !this.ids.amp) {
      this.ids.amp = this.graph.addModule({ type: "amp", params: { db: this.config.amp.db, active: true } });
    }
    if (this.blocks.env && !this.ids.env) {
      this.ids.env = this.graph.addModule({ type: "env", params: this.config.env });
    }
    if (this.blocks.lfo && !this.ids.lfo) {
      this.ids.lfo = this.graph.addModule({ type: "lfo", params: this.config.lfo });
    }
    this._rewireGraph();
    // Output module owns its own fadeIn — find and call it.
    this.graph.getModule(this.ids.output)?.fadeIn?.(this.config.vol);
  }

  stop() {
    if (!this.graph.ctx) return;
    // Mirror legacy behavior: fadeOut, then rebuild the oscillator so the
    // next start() finds a fresh source (OscillatorNode.start() is one-shot).
    this.graph.getModule(this.ids.output)?.fadeOut?.();
    setTimeout(() => {
      if (this.ids.osc) {
        this.graph.removeModule(this.ids.osc);
        this.ids.osc = this.graph.addModule({ type: "oscillator", params: { type: this.config.osc.type, freq: this.config.osc.freq } });
        // The new oscillator's start() will be called on next start(config).
        this._rewireGraph();
      }
    }, 90);
  }

  dispose() {
    try { this.graph.dispose(); } catch {}
    this.ids = { osc: null, filter: null, amp: null, env: null, lfo: null, output: null };
  }

  // ---- Param setters (mirror legacy AudioEngine surface) ----

  setOscType(type) {
    if (this.ids.osc) this.graph.setParam(this.ids.osc, "type", type);
    if (this.config) this.config.osc.type = type;
  }
  setOscFreq(hz) {
    if (this.ids.osc) this.graph.setParam(this.ids.osc, "freq", hz);
    if (this.config) this.config.osc.freq = hz;
  }
  // Live pitch from keyboard — like setOscFreq but doesn't store back to config.
  setOscFreqLive(hz) {
    if (this.ids.osc) this.graph.setParam(this.ids.osc, "freq", hz);
  }
  setCutoff(hz) {
    if (this.ids.filter) this.graph.setParam(this.ids.filter, "cutoff", hz);
    if (this.config) this.config.flt.cutoff = hz;
  }
  setQ(q) {
    if (this.ids.filter) this.graph.setParam(this.ids.filter, "resonance", q);
    if (this.config) this.config.flt.q = q;
  }
  setFilterMode(m) {
    if (this.ids.filter) this.graph.setParam(this.ids.filter, "mode", m);
    if (this.config) this.config.flt.mode = m;
  }
  setAmpDb(db) {
    if (this.ids.amp) this.graph.setParam(this.ids.amp, "level", db);
    if (this.config) this.config.amp.db = db;
  }
  setEnv(partial) {
    if (this.config) Object.assign(this.config.env, partial);
    if (!this.ids.env) return;
    for (const [k, v] of Object.entries(partial)) this.graph.setParam(this.ids.env, k, v);
  }
  setLfo(partial) {
    if (this.config) {
      if (!this.config.lfo) this.config.lfo = {};
      Object.assign(this.config.lfo, partial);
    }
    if (!this.ids.lfo) return;
    for (const [k, v] of Object.entries(partial)) this.graph.setParam(this.ids.lfo, k, v);
  }
  setVol(v) {
    if (this.ids.output) this.graph.setParam(this.ids.output, "vol", v);
    if (this.config) this.config.vol = v;
  }

  // ---- Gating ----
  // Legacy single-source API — kept so existing Keyboard/Gate panels don't
  // need to change. Source defaults to "default" for callers that don't pass
  // one; Keyboard/Gate panels still write their per-source flag to the store
  // for wire-highlight purposes (that's a UI concern, separate from this).
  noteOn(source = "default")  {
    if (!this.blocks.env || !this.ids.env) return;
    this.graph.getModule(this.ids.env)?.onGate("trigger", source, true);
  }
  noteOff(source = "default") {
    if (!this.blocks.env || !this.ids.env) return;
    this.graph.getModule(this.ids.env)?.onGate("trigger", source, false);
  }

  // ---- Topology (block on/off) ----

  addBlock(id) {
    this.blocks[id] = true;
    if (!this.graph.ctx) return; // pre-start; just track the flag
    if (id === "filter" && !this.ids.filter) {
      this.ids.filter = this.graph.addModule({ type: "filter", params: { cutoff: this.config.flt.cutoff, q: this.config.flt.q, mode: this.config.flt.mode } });
    }
    if (id === "amp" && !this.ids.amp) {
      this.ids.amp = this.graph.addModule({ type: "amp", params: { db: this.config.amp.db, active: true } });
    }
    if (id === "env" && !this.ids.env) {
      this.ids.env = this.graph.addModule({ type: "env", params: this.config.env });
    }
    if (id === "lfo" && !this.ids.lfo) {
      this.ids.lfo = this.graph.addModule({ type: "lfo", params: this.config.lfo });
    }
    // keyboard and gate are UI-only — no engine module.
    this._rewireGraph();
  }

  removeBlock(id) {
    this.blocks[id] = false;
    if (!this.graph.ctx) return;
    // Legacy semantics: removing keyboard restores the freq knob value.
    if (id === "keyboard" && this.config && this.ids.osc) {
      this.graph.setParam(this.ids.osc, "freq", this.config.osc.freq);
    }
    if (id === "env" && this.ids.env) {
      this.graph.getModule(this.ids.env)?.reset();
    }
    if (id === "filter" || id === "amp" || id === "env" || id === "lfo") {
      const slot = this.ids[id];
      if (slot) {
        this.graph.removeModule(slot);
        this.ids[id] = null;
      }
    }
    this._rewireGraph();
  }

  // ---- Read access for visualisers / panels ----

  getAnalyser(name) {
    if (name === "osc") return this.graph.getModule(this.ids.osc)?.tap || null;
    if (name === "out") return this.graph.getModule(this.ids.output)?.getAnalyser?.() || null;
    return null;
  }
  getVcaValue()   { return this.graph.getModule(this.ids.env)?.getValue?.() ?? 1; }
  getEnvPhase()   { return this.graph.getModule(this.ids.env)?.getPhase?.() ?? "idle"; }
  getEnvStart()   { return this.graph.getModule(this.ids.env)?.getStart?.() ?? 0; }
  getFilterNode() { return this.graph.getModule(this.ids.filter)?.getNode?.() ?? null; }

  // ---- Internal: rebuild the canonical signal chain ----
  // osc → [filter] → [env audio] → [amp] → output, plus LFO → filter.cutoff.
  // Idempotent: clears all connections and reconnects from the current ids.
  _rewireGraph() {
    if (!this.graph.ctx) return;
    if (!this.ids.osc || !this.ids.output) return;

    for (const c of this.graph.listConnections()) this.graph.removeConnection(c.id);

    let upstreamId   = this.ids.osc;
    let upstreamPort = "main";

    if (this.ids.filter) {
      this.graph.addConnection({ fromId: upstreamId, fromPort: upstreamPort, toId: this.ids.filter, toPort: "input" });
      upstreamId = this.ids.filter; upstreamPort = "output";
    }
    if (this.ids.env) {
      this.graph.addConnection({ fromId: upstreamId, fromPort: upstreamPort, toId: this.ids.env, toPort: "input" });
      upstreamId = this.ids.env; upstreamPort = "output";
    }
    if (this.ids.amp) {
      this.graph.addConnection({ fromId: upstreamId, fromPort: upstreamPort, toId: this.ids.amp, toPort: "input" });
      upstreamId = this.ids.amp; upstreamPort = "output";
    }
    this.graph.addConnection({ fromId: upstreamId, fromPort: upstreamPort, toId: this.ids.output, toPort: "input" });

    if (this.ids.lfo && this.ids.filter) {
      this.graph.addConnection({ fromId: this.ids.lfo, fromPort: "cv", toId: this.ids.filter, toPort: "cutoff" });
    }
  }
}
