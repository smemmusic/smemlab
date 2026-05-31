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
//   emitGate(fromId, fromPort, sourceId, active)
//   getModule(id) / listModules() / listConnections()
//
// Module classes + defaults are looked up via `byType(type)` from the central
// manifest registry — no per-type imports live here.

import { byType } from "../../modules/_registry.js";
import { PORT_TYPE, PORT_DIR, newId, portsCompatible } from "./types.js";

export class GraphEngine {
  constructor() {
    this.ctx = null;
    this.modules = new Map();      // id → AudioModule instance
    this.connections = new Map();  // id → { id, fromId, fromPort, toId, toPort, type }
    this._gateConnections = new Map();
    // Switch-CV poll loop (set by the bridge). One handler fans changes back
    // into the store via setModuleParam.
    this._onSwitchChange = null;
    this._pollRaf = 0;
  }

  setSwitchChangeHandler(fn) {
    this._onSwitchChange = fn;
    if (fn && !this._pollRaf) this._startPollLoop();
    if (!fn && this._pollRaf) { cancelAnimationFrame(this._pollRaf); this._pollRaf = 0; }
  }

  _startPollLoop() {
    const tick = () => {
      if (this._onSwitchChange) {
        const cb = this._onSwitchChange;
        const isConn = (id, port) => this._hasConnectionTo(id, port);
        for (const m of this.modules.values()) m._pollSwitches?.(cb, isConn);
      }
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
    } else if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    for (const m of this.modules.values()) m.start?.();
  }

  isRunning() { return !!this.ctx && this.ctx.state === "running"; }

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
    return moduleId;
  }

  removeModule(id) {
    const m = this.modules.get(id);
    if (!m) return;
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

    const connId = id || newId();
    const conn = { id: connId, fromId, fromPort, toId, toPort, type: fromDecl.type };

    if (toDecl.type === PORT_TYPE.GATE) {
      this._gateConnections.set(connId, conn);
    } else {
      const srcNode = this._getOutNode(from, fromPort, fromDecl.type);
      const dstNode = this._getInNode(to,   toPort,   toDecl.type);
      if (!srcNode || !dstNode) {
        throw new Error(`Port wired but underlying node missing (${fromId}.${fromPort} → ${toId}.${toPort})`);
      }
      srcNode.connect(dstNode);
    }

    this.connections.set(connId, conn);
    return connId;
  }

  removeConnection(id) {
    const c = this.connections.get(id);
    if (!c) return;
    if (c.type === PORT_TYPE.GATE) {
      const to = this.modules.get(c.toId);
      to?.onGate?.(c.toPort, c.fromId, false);
      this._gateConnections.delete(id);
    } else {
      const from = this.modules.get(c.fromId);
      const to   = this.modules.get(c.toId);
      const srcNode = from && this._getOutNode(from, c.fromPort, c.type);
      const dstNode = to   && this._getInNode(to,   c.toPort,   c.type);
      if (srcNode && dstNode) {
        try { srcNode.disconnect(dstNode); } catch {}
      }
    }
    this.connections.delete(id);
  }

  // ---- Params ----

  setParam(id, name, value) {
    const m = this.modules.get(id);
    if (!m) return;
    m.setParam?.(name, value);
  }

  // ---- Gate dispatch ----

  emitGate(fromId, fromPort, sourceId, active) {
    for (const c of this._gateConnections.values()) {
      if (c.fromId === fromId && c.fromPort === fromPort) {
        this.modules.get(c.toId)?.onGate(c.toPort, sourceId, active);
      }
    }
  }

  // ---- Internal helpers ----

  _findPort(module, name, dir) {
    return module.listPorts().find((p) => p.name === name && p.dir === dir) || null;
  }

  _getOutNode(module, name, type) {
    if (type === PORT_TYPE.AUDIO) return module.getAudioOut(name);
    if (type === PORT_TYPE.CV)    return module.getCvOut(name);
    if (type === PORT_TYPE.PITCH) return module.getPitchOut(name);
    return null;
  }

  _getInNode(module, name, type) {
    if (type === PORT_TYPE.AUDIO) return module.getAudioIn(name);
    if (type === PORT_TYPE.CV)    return module.getCvIn(name);
    // CV → pitch coercion: a CV output landing on a pitch input goes into the
    // pitch scaler (interpreted as V/oct directly).
    if (type === PORT_TYPE.PITCH) return module.getPitchIn(name);
    return null;
  }
}
