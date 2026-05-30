// Thin facade around GraphEngine that exposes the convenience methods panels,
// Transport, and visualisers still call directly:
//   start(config), stop(), isRunning()
//   noteOn(source) / noteOff(source)  — directly nudges the env module's gate
//   setOscFreqLive(hz)                — live keyboard pitch override
//   getAnalyser(name) / getVcaValue() / getEnvPhase() / getEnvStart() / getFilterNode()
//
// Lookups use the reserved canonical IDs from graphBuilder.js. Free-mode
// modules added via the palette are managed entirely by the bridge — the
// facade only knows about the canonical slots.
//
// The bridge owns module/connection lifecycle (it diffs the store's
// modules + connections arrays). The facade only owns lifecycle bookkeeping
// (start / stop / context creation) and the synchronous panel hooks.

import { GraphEngine } from "./GraphEngine.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

export class GraphEngineFacade {
  constructor() {
    this.graph = new GraphEngine();
    // Snapshot of the legacy-shape config passed to start(), used for
    // re-creating the oscillator on stop()'s scheduled rebuild.
    this.config = null;
  }

  // ---- Lifecycle ----

  isRunning() { return this.graph.isRunning(); }

  // Legacy signature: takes the snapshot Transport/Landing assembles. We only
  // keep what's needed for the oscillator rebuild on stop(); module creation
  // is the bridge's job (it sees modules array change and adds them).
  start(config) {
    this.config = config ? JSON.parse(JSON.stringify(config)) : this.config;
    this.graph.start();
    // Restart any oscillator-bearing modules that were paused — GraphEngine.start
    // already calls instance.start?.() on every module, so this is a no-op if
    // already started.
  }

  stop() {
    // Mirror legacy behavior: fade out the output, then rebuild the oscillator
    // so the next start() finds a fresh source (OscillatorNode.start is one-shot).
    this.graph.getModule(CANONICAL_IDS.output)?.fadeOut?.();
    setTimeout(() => {
      const osc = this.graph.getModule(CANONICAL_IDS.osc);
      if (!osc || !this.config) return;
      // Rebuild the canonical oscillator in place. We tear the module down,
      // recreate it under the same ID, and let the bridge's connection diff
      // restore its wires on the next store update (or, if no diff fires,
      // we restore them ourselves below).
      const oscParams = { ...osc.params };
      const downstream = this._snapshotOutgoing(CANONICAL_IDS.osc);
      this.graph.removeModule(CANONICAL_IDS.osc);
      this.graph.addModule({ id: CANONICAL_IDS.osc, type: "oscillator", params: oscParams });
      for (const c of downstream) {
        this.graph.addConnection(c);
      }
    }, 90);
  }

  // ---- Synchronous panel hooks ----

  // Emit a gate from a specific module's output port. Routes through the
  // GraphEngine's _gateConnections table to whatever destinations the user
  // (or canonical chain) wired up.
  emitGate(fromId, fromPort, sourceId, active) {
    this.graph.emitGate(fromId, fromPort, sourceId, active);
  }

  // Tell a KeyboardModule instance to play a MIDI note. Updates its pitchOut
  // ConstantSourceNode; the V/oct signal flows through whatever destinations
  // the instance's `pitch` port is wired to.
  playMidi(moduleId, midi) {
    this.graph.getModule(moduleId)?.playMidi?.(midi);
  }

  // Legacy convenience for chapter-mode KeyboardPanel during transition —
  // bypasses the V/oct flow and writes the absolute Hz directly to the
  // canonical oscillator. Kept until the canonical KeyboardModule fully
  // replaces it.
  setOscFreqLive(hz) {
    this.graph.setParam(CANONICAL_IDS.osc, "freq", hz);
  }

  // ---- Visualiser / introspection hooks ----

  getAnalyser(name) {
    if (name === "osc") return this.graph.getModule(CANONICAL_IDS.osc)?.tap || null;
    if (name === "out") return this.graph.getModule(CANONICAL_IDS.output)?.getAnalyser?.() || null;
    return null;
  }

  // Per-instance analyser lookup for free-mode visualisers. Oscillators
  // expose `.tap`, outputs expose `getAnalyser()`. Anything else returns null.
  getInstanceAnalyser(instanceId) {
    const m = this.graph.getModule(instanceId);
    if (!m) return null;
    return m.tap || m.getAnalyser?.() || null;
  }
  getVcaValue()   { return this.graph.getModule(CANONICAL_IDS.env)?.getValue?.() ?? 1; }
  getEnvPhase()   { return this.graph.getModule(CANONICAL_IDS.env)?.getPhase?.() ?? "idle"; }
  getEnvStart()   { return this.graph.getModule(CANONICAL_IDS.env)?.getStart?.() ?? 0; }
  getFilterNode() { return this.graph.getModule(CANONICAL_IDS.filter)?.getNode?.() ?? null; }

  // Per-instance env state for free-mode envelope panels. Reads directly off
  // the EnvelopeModule (which tracks phase + start internally via onGate),
  // so this works whether or not the canonical store-level envPhase is set.
  getInstanceEnvValue(instanceId) { return this.graph.getModule(instanceId)?.getValue?.() ?? 1; }
  getInstanceEnvPhase(instanceId) { return this.graph.getModule(instanceId)?.getPhase?.() ?? "idle"; }
  getInstanceEnvStart(instanceId) { return this.graph.getModule(instanceId)?.getStart?.() ?? 0; }

  // Accessor for the bridge: drive the underlying GraphEngine directly.
  getGraph() { return this.graph; }

  // ---- Internal ----

  _snapshotOutgoing(moduleId) {
    return this.graph.listConnections()
      .filter((c) => c.fromId === moduleId)
      .map((c) => ({ id: c.id, fromId: c.fromId, fromPort: c.fromPort, toId: c.toId, toPort: c.toPort }));
  }
}
