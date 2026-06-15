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

  // Emit a gate event from a specific module's output port. Routes through
  // GraphEngine's _gateConnections to every wired destination.
  emitGate(fromId, fromPort, sourceId, active) {
    this.graph.emitGate(fromId, fromPort, sourceId, active);
  }

  // Tell a KeyboardModule instance to play a MIDI note.
  playMidi(moduleId, midi) {
    this.graph.getModule(moduleId)?.playMidi?.(midi);
  }

  // ---- Visualiser / introspection ----

  // Per-instance analyser lookup. Oscillators expose `.tap`; the output
  // module exposes `getAnalyser()`. Anything else returns null.
  getInstanceAnalyser(instanceId) {
    const m = this.graph.getModule(instanceId);
    if (!m) return null;
    return m.tap || m.getAnalyser?.() || null;
  }

  // Per-instance env state for envelope panel visualisers.
  getInstanceEnvValue(instanceId) { return this.graph.getModule(instanceId)?.getValue?.() ?? 1; }
  getInstanceEnvPhase(instanceId) { return this.graph.getModule(instanceId)?.getPhase?.() ?? "idle"; }
  getInstanceEnvStart(instanceId) { return this.graph.getModule(instanceId)?.getStart?.() ?? 0; }

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
