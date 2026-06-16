// Map-based audio engine for the typed-port graph. Drives Web Audio directly.
//
// Public surface (called by the bridge / chapters / palette):
//   start()                            — lazily creates AudioContext
//   stop() / dispose()
//   addModule({ id?, type, params })   → id
//   removeModule(id)
//   addConnection({ id?, fromId, fromPort, toId, toPort }) → id
//   removeConnection(id)
//   setParam(id, name, value)
//   getModule(id) / listModules() / listConnections()
//
// All port types — audio, cv, gate, pitch — are audio-graph signals wired by a
// single audio-thread path (resolveOut/resolveIn → connect). There is no
// main-thread signal delivery: control logic lives in AudioWorkletProcessors,
// gates are 0/1 signals, and manual sources emit ConstantSource signals.
//
// Module classes + defaults are looked up via `byType(type)` from the central
// manifest registry — no per-type imports live here.

import { byType, MODULES } from "../../modules/_registry.js";
import { PORT_DIR, newId, portsCompatible } from "./types.js";
import { registerWorkletProcessors, workletsReady } from "../workletLoader.js";

const NOOP = () => {};

// Every distinct AudioWorklet processor declared by a worklet-backed module
// class (clock, envelopes, counters, drum-seq, mux, quantizer). Registered once
// per context at start() so module constructors can build their nodes
// synchronously. Deduped by name inside registerWorkletProcessors.
function collectProcessors() {
  const out = [];
  for (const m of MODULES) {
    const C = m.Cls;
    if (C && C.PROCESSOR && C.PROCESSOR_CODE) out.push({ name: C.PROCESSOR, code: C.PROCESSOR_CODE });
  }
  return out;
}

export class GraphEngine {
  constructor() {
    this.ctx = null;
    this.modules = new Map();      // id → AudioModule instance
    this.connections = new Map();  // id → { id, fromId, fromPort, toId, toPort, type }
    // Switch-CV poll loop (set by the bridge). One handler fans changes back
    // into the store via setModuleParam.
    this._onSwitchChange = null;
    this._pollRaf = 0;
    // Modules that opted into a per-frame poll via `_pollOnFrame = true`.
    // The loop iterates only this set, so adding modules without per-frame
    // work (most of them) costs nothing per tick.
    this._pollers = new Set();
  }

  setSwitchChangeHandler(fn) {
    this._onSwitchChange = fn;
    if (fn && !this._pollRaf) this._startPollLoop();
    if (!fn && this._pollRaf) { cancelAnimationFrame(this._pollRaf); this._pollRaf = 0; }
  }

  _startPollLoop() {
    const tick = () => {
      const cb = this._onSwitchChange || NOOP;
      const isConn = (id, port) => this._hasConnectionTo(id, port);
      for (const m of this._pollers) m._onPollFrame?.(cb, isConn);
      this._pollRaf = requestAnimationFrame(tick);
    };
    this._pollRaf = requestAnimationFrame(tick);
  }

  _hasConnectionTo(toId, toPort) {
    for (const c of this.connections.values()) {
      if (c.toId === toId && c.toPort === toPort) return true;
    }
    return false;
  }

  // ---- Lifecycle ----

  start() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 0.005 });
      // Register every worklet processor up front so WorkletModule constructors
      // can build their AudioWorkletNode synchronously. The bridge awaits
      // whenReady() before its first reconcile.
      this._ready = registerWorkletProcessors(this.ctx, collectProcessors());
      // Firefox and Safari always create the context in "suspended" state and
      // only flip to "running" once resume() resolves — which is asynchronous.
      // By the time it resolves, the bridge has already called addModule() for
      // the journey's initial modules, and addModule() skipped instance.start()
      // because isRunning() was still false. Catch the suspended→running
      // transition and (re-)start every module then. AudioModule.start() is
      // idempotent (oscillators guard with _started, others are no-op without
      // a gate), so iterating every module is safe.
      this.ctx.addEventListener("statechange", () => {
        if (this.ctx?.state === "running") {
          for (const m of this.modules.values()) m.start?.();
        }
      });
    }
    // resume() must be called for every newly-created context too — not only
    // when re-entering a previously-suspended one. The user gesture must be on
    // the call stack (Safari requirement), so this stays synchronous; the
    // returned promise resolves on its own and statechange picks up the flip.
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    for (const m of this.modules.values()) m.start?.();
  }

  isRunning() { return !!this.ctx && this.ctx.state === "running"; }

  // Resolves once every worklet processor is registered on the context, so
  // WorkletModule constructors can build their nodes. Null-safe before start().
  whenReady() { return this._ready || (this.ctx ? workletsReady(this.ctx) : Promise.resolve()); }

  // Pause the audio thread (power off). Keeps the whole graph intact — nodes,
  // oscillators and connections survive — so start() just resumes. The context
  // clock freezes, so callers must finish any de-click ramp before calling this.
  suspend() {
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend().catch(() => {});
  }

  // Global visuals toggle. Walks every live module and asks it to connect or
  // disconnect its viz-only analyser side-branches. Newly-added modules also
  // pick up the current state in addModule().
  setVisualsEnabled(enabled) {
    this._visualsEnabled = !!enabled;
    for (const m of this.modules.values()) m.setVisualsEnabled?.(this._visualsEnabled);
  }

  dispose() {
    if (!this.ctx) return;
    if (this._pollRaf) { cancelAnimationFrame(this._pollRaf); this._pollRaf = 0; }
    this._onSwitchChange = null;
    for (const c of this.connections.keys()) this.removeConnection(c);
    for (const id of this.modules.keys()) this.removeModule(id);
    try { this.ctx.close(); } catch {}
    this.ctx = null;
  }

  // ---- Modules ----

  addModule({ id, type, params }) {
    if (!this.ctx) throw new Error("GraphEngine.start() must be called before addModule");
    const manifest = byType(type);
    if (!manifest) throw new Error(`Unknown module type "${type}"`);
    const moduleId = id || newId();
    if (this.modules.has(moduleId)) throw new Error(`Module id collision: ${moduleId}`);
    const merged = { ...manifest.defaults(), ...(params || {}) };
    const instance = new manifest.Cls(this.ctx, merged);
    instance.id = moduleId;
    instance.type = type;
    if (this.isRunning()) instance.start?.();
    // Newly-added modules inherit the current global visuals state so taps
    // stay consistent if a module is added while visuals are off.
    if (this._visualsEnabled === false) instance.setVisualsEnabled?.(false);
    this.modules.set(moduleId, instance);
    if (instance._pollOnFrame) this._pollers.add(instance);
    return moduleId;
  }

  removeModule(id) {
    const m = this.modules.get(id);
    if (!m) return;
    this._pollers.delete(m);
    for (const [cid, c] of this.connections) {
      if (c.fromId === id || c.toId === id) this.removeConnection(cid);
    }
    try { m.dispose(); } catch {}
    this.modules.delete(id);
  }

  getModule(id)     { return this.modules.get(id) || null; }
  listModules()     { return [...this.modules.values()]; }
  listConnections() { return [...this.connections.values()]; }

  // ---- Connections ----

  addConnection({ id, fromId, fromPort, toId, toPort }) {
    const from = this.modules.get(fromId);
    const to   = this.modules.get(toId);
    if (!from || !to) throw new Error(`Connection refers to unknown module(s): ${fromId} → ${toId}`);

    const fromDecl = this._findPort(from, fromPort, PORT_DIR.OUT);
    const toDecl   = this._findPort(to,   toPort,   PORT_DIR.IN);
    if (!fromDecl) throw new Error(`Port ${fromId}.${fromPort} (out) not found`);
    if (!toDecl)   throw new Error(`Port ${toId}.${toPort} (in) not found`);
    if (!portsCompatible(fromDecl, toDecl)) {
      throw new Error(`Incompatible ports: ${fromDecl.type}.out → ${toDecl.type}.in`);
    }

    // Unified routing: every port type — audio, cv, gate, pitch — is an
    // audio-graph signal. Resolve both ends to a { node, bus } and connect on
    // the audio thread. Gate is just a 0/1 signal; there is no main-thread path.
    const src = from.resolveOut(fromPort, fromDecl.type);
    const dst = to.resolveIn(toPort, toDecl.type);
    if (!src || !dst) {
      throw new Error(`Port wired but underlying node missing (${fromId}.${fromPort} → ${toId}.${toPort})`);
    }
    connectPorts(src, dst);

    const connId = id || newId();
    const conn = { id: connId, fromId, fromPort, toId, toPort, type: fromDecl.type };
    this.connections.set(connId, conn);
    return connId;
  }

  removeConnection(id) {
    const c = this.connections.get(id);
    if (!c) return;
    const from = this.modules.get(c.fromId);
    const to   = this.modules.get(c.toId);
    const src = from && from.resolveOut(c.fromPort, c.type);
    const dst = to   && to.resolveIn(c.toPort,   c.type);
    if (src && dst) {
      try { disconnectPorts(src, dst); } catch {}
    }
    this.connections.delete(id);
  }

  // ---- Params ----

  setParam(id, name, value) {
    const m = this.modules.get(id);
    if (!m) return;
    m.setParam?.(name, value);
  }

  // ---- Internal helpers ----

  _findPort(module, name, dir) {
    return module.listPorts().find((p) => p.name === name && p.dir === dir) || null;
  }
}

// Connect a resolved output to a resolved input. An AudioParam destination
// takes only the source output index; an AudioNode destination takes both
// output and input bus indices (worklet modules expose multiple buses).
function connectPorts(src, dst) {
  if (dst.node instanceof AudioParam) src.node.connect(dst.node, src.bus);
  else                                src.node.connect(dst.node, src.bus, dst.bus);
}

function disconnectPorts(src, dst) {
  if (dst.node instanceof AudioParam) src.node.disconnect(dst.node, src.bus);
  else                                src.node.disconnect(dst.node, src.bus, dst.bus);
}
