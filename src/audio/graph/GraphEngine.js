// Map-based audio engine for the typed-port graph. Instantiated behind the
// `window.__newEngine` feature flag while the legacy AudioEngine still drives
// the app. Once flipped (step 3) this becomes the only path.
//
// Public surface (called by the bridge / chapters / palette):
//   start()                            — lazily creates AudioContext
//   stop() / dispose()
//   addModule({ id?, type, params })   → id
//   removeModule(id)
//   addConnection({ id?, fromId, fromPort, toId, toPort }) → id
//   removeConnection(id)
//   setParam(id, name, value)
//   sendGate(toId, toPort, sourceId, active)  — direct gate dispatch
//   getModule(id) / listModules() / listConnections()

import { OscillatorModule } from "../modules/OscillatorModule.js";
import { FilterModule }     from "../modules/FilterModule.js";
import { AmplifierModule }  from "../modules/AmplifierModule.js";
import { EnvelopeModule }   from "../modules/EnvelopeModule.js";
import { LfoModule }        from "../modules/LfoModule.js";
import { OutputModule }     from "../modules/OutputModule.js";
import { GateModule }       from "../modules/GateModule.js";
import { KeyboardModule }   from "../modules/KeyboardModule.js";
import {
  PORT_TYPE, PORT_DIR, newId, portsCompatible,
} from "./types.js";

// Module class registry keyed by string type. Each entry also carries a
// default-params builder so callers can `addModule({ type })` without
// specifying every field.
const MODULE_REGISTRY = {
  oscillator: {
    Cls: OscillatorModule,
    defaults: () => ({ type: "sawtooth", freq: 220 }),
  },
  filter: {
    Cls: FilterModule,
    defaults: () => ({ cutoff: 1200, q: 1, mode: "lowpass" }),
  },
  amp: {
    Cls: AmplifierModule,
    defaults: () => ({ db: 0, active: true }),
  },
  env: {
    Cls: EnvelopeModule,
    defaults: () => ({ a: 0.01, d: 0.2, sustainDb: -12, r: 0.3 }),
  },
  lfo: {
    Cls: LfoModule,
    defaults: () => ({ rate: 5, depth: 0.4, shape: "sine" }),
  },
  output: {
    Cls: OutputModule,
    defaults: () => ({ vol: 80 }),
  },
  gate: {
    Cls: GateModule,
    defaults: () => ({}),
  },
  keyboard: {
    Cls: KeyboardModule,
    defaults: () => ({}),
  },
};

export class GraphEngine {
  constructor() {
    this.ctx = null;
    this.modules = new Map();      // id → AudioModule instance
    this.connections = new Map();  // id → { id, fromId, fromPort, toId, toPort, type }
    // Per-connection gate routes: connectionId → { toId, toPort, fromId }.
    // Live state (which sources are open per destination) lives on the
    // destination module (EnvelopeModule._gateSources).
    this._gateConnections = new Map();
    // Polling for switch-CV quantisation. The bridge sets this handler at
    // mount; modules with switch inputs are polled each frame and the handler
    // forwards changes to the store via setModuleParam.
    this._onSwitchChange = null;
    this._pollRaf = 0;
  }

  // Bridge calls this once to register a callback that fires when a switch CV
  // quantisation produces a new value. Signature: (moduleId, switchName, value).
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
        for (const m of this.modules.values()) {
          m._pollSwitches?.(cb, isConn);
        }
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
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } else if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    // Start any oscillator-bearing modules that have a start() method.
    for (const m of this.modules.values()) m.start?.();
  }

  isRunning() { return !!this.ctx && this.ctx.state === "running"; }

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
    const entry = MODULE_REGISTRY[type];
    if (!entry) throw new Error(`Unknown module type "${type}"`);
    const moduleId = id || newId();
    if (this.modules.has(moduleId)) throw new Error(`Module id collision: ${moduleId}`);
    const merged = { ...entry.defaults(), ...(params || {}) };
    const instance = new entry.Cls(this.ctx, merged);
    instance.id = moduleId;
    instance.type = type;
    if (this.isRunning()) instance.start?.();
    this.modules.set(moduleId, instance);
    return moduleId;
  }

  removeModule(id) {
    const m = this.modules.get(id);
    if (!m) return;
    // Tear down any connections touching this module first.
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
      // Force-release this source so the destination's gate state doesn't latch.
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
  // Called by the source module (or a UI surface acting as a source) when its
  // gate state changes. Fans out to every destination this source is wired to.
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

export { MODULE_REGISTRY };
