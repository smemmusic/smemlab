// Thin facade around GraphEngine. The bridge owns module + connection lifecycle
// (diffing the store's modules + connections arrays); this facade exposes the
// synchronous panel hooks (gate emit, MIDI play) and visualiser lookups that
// can't go through React state.

import { GraphEngine } from "./GraphEngine.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

export class GraphEngineFacade {
  constructor() {
    this.graph = new GraphEngine();
  }

  // ---- Lifecycle ----

  isRunning() { return this.graph.isRunning(); }

  start() {
    this.graph.start();
    // GraphEngine.start() calls instance.start?.() on every module already.
  }

  stop() {
    // Fade the output and rebuild the canonical oscillator so the next
    // start() finds a fresh OscillatorNode (start() can only be called once).
    this.graph.getModule(CANONICAL_IDS.output)?.fadeOut?.();
    setTimeout(() => {
      const osc = this.graph.getModule(CANONICAL_IDS.osc);
      if (!osc) return;
      const oscParams = { ...osc.params };
      const downstream = this._snapshotOutgoing(CANONICAL_IDS.osc);
      this.graph.removeModule(CANONICAL_IDS.osc);
      this.graph.addModule({ id: CANONICAL_IDS.osc, type: "oscillator", params: oscParams });
      for (const c of downstream) this.graph.addConnection(c);
    }, 90);
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

  // Direct access to the GraphEngine. The bridge uses this; the smoke-test
  // helper in engineSingleton uses this.
  getGraph() { return this.graph; }

  // ---- Internal ----

  _snapshotOutgoing(moduleId) {
    return this.graph.listConnections()
      .filter((c) => c.fromId === moduleId)
      .map((c) => ({ id: c.id, fromId: c.fromId, fromPort: c.fromPort, toId: c.toId, toPort: c.toPort }));
  }
}
