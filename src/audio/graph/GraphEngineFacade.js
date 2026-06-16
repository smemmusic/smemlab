// Thin facade around GraphEngine. The bridge owns module + connection lifecycle
// (diffing the store's modules + connections arrays); this facade exposes the
// synchronous panel hooks (gate emit, MIDI play) and visualiser lookups that
// can't go through React state.

import { GraphEngine } from "./GraphEngine.js";

export class GraphEngineFacade {
  constructor() {
    this.graph = new GraphEngine();
    this._suspendTimer = null;
  }

  // ---- Lifecycle ----

  isRunning() { return this.graph.isRunning(); }

  start() {
    // Cancel a still-pending suspend from a quick off→on so we don't power down
    // the context we're turning back on.
    if (this._suspendTimer) { clearTimeout(this._suspendTimer); this._suspendTimer = null; }
    this.graph.start();              // creates / resumes the context, (re)starts modules
    for (const m of this.graph.listModules()) m.fadeIn?.();
  }

  stop() {
    // De-click ramp, then suspend the context once the ramp has finished — the
    // whole graph (oscillators, nodes, connections) stays intact and resumes on
    // start(). The clock freezes when suspended, so we wait out the fade first.
    for (const m of this.graph.listModules()) m.fadeOut?.();
    if (this._suspendTimer) clearTimeout(this._suspendTimer);
    this._suspendTimer = setTimeout(() => {
      this._suspendTimer = null;
      this.graph.suspend();
    }, 60);
  }

  // ---- Synchronous panel hooks ----

  // Tell a KeyboardModule instance to play a MIDI note.
  playMidi(moduleId, midi) {
    this.graph.getModule(moduleId)?.playMidi?.(midi);
  }

  // Set a manual gate source (trigger button, keyboard key) high/low. The
  // module's gate is an audio-rate ConstantSource; this sets its offset at
  // currentTime — the sanctioned main→audio crossing for human input.
  setGate(moduleId, active) {
    this.graph.getModule(moduleId)?.setGate?.(active);
  }

  // ---- Visualiser / introspection ----

  // Per-instance analyser lookup. Oscillators expose `.tap`; the output
  // module exposes `getAnalyser()`. Anything else returns null.
  getInstanceAnalyser(instanceId) {
    const m = this.graph.getModule(instanceId);
    if (!m) return null;
    return m.tap || m.getAnalyser?.() || null;
  }

  // Per-instance env state for envelope panel visualisers, read from the
  // worklet's throttled snapshot (display only). Phase is mapped to drawEnv's
  // vocabulary (idle | ad | rel); start is a local performance.now() stamp
  // derived from the snapshot's per-trigger counter, so the viz can animate the
  // dot without a cross-thread clock.
  getInstanceEnvValue(instanceId) { return this.graph.getModule(instanceId)?.getValue?.() ?? 0; }
  getInstanceEnvPhase(instanceId) {
    const ph = this.graph.getModule(instanceId)?.getPhase?.() ?? "idle";
    if (ph === "idle") return "idle";
    return ph === "release" ? "rel" : "ad";
  }
  getInstanceEnvStart(instanceId) {
    const trig = this.graph.getModule(instanceId)?.getTrig?.() ?? 0;
    if (!this._envStart) this._envStart = new Map();
    const prev = this._envStart.get(instanceId);
    if (!prev || prev.trig !== trig) {
      const start = performance.now();
      this._envStart.set(instanceId, { trig, start });
      return start;
    }
    return prev.start;
  }

  // Forward the global visuals toggle to every module. The bridge calls this
  // when the store's visualsEnabled changes.
  setVisualsEnabled(enabled) { this.graph.setVisualsEnabled(enabled); }

  // AudioContext snapshot for the settings readout. Null until start() runs.
  getAudioInfo() {
    const ctx = this.graph.ctx;
    if (!ctx) return null;
    return {
      sampleRate:    ctx.sampleRate,
      baseLatency:   ctx.baseLatency,
      outputLatency: ctx.outputLatency
    };
  }

  // Direct access to the GraphEngine. The bridge uses this; the smoke-test
  // helper in engineSingleton uses this.
  getGraph() { return this.graph; }
}
