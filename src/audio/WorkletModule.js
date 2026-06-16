import { AudioModule } from "./AudioModule.js";
import { PORT_DIR, CONTROL_KIND } from "./graph/types.js";

// Base for control modules whose logic runs in an AudioWorkletProcessor, so all
// their signals (gate / cv / pitch) are computed and delivered on the audio
// thread — never the main thread. The framework guarantees there is no
// main-thread signal path: a subclass only authors a processor and declares
// ports; the engine wires the worklet's buses like any other audio connection.
//
// Subclasses declare:
//   static PROCESSOR       — registered processor name (see workletLoader)
//   static PROCESSOR_CODE  — the processor source string (registered once per
//                            AudioContext by the engine BEFORE any module is
//                            built, so this constructor can build the node
//                            synchronously)
//   static PORTS / CONTROLS — as usual (drive listPorts + the UI)
//
// Bus layout is derived from the declared ports (declaration order = bus index):
//   - every OUT port  → one mono worklet output bus
//   - every IN  port  → one worklet input bus (gate/cv/audio/pitch signal in)
//   - every KNOB control → a worklet AudioParam of the same name (the processor
//     reads its value; unless cvInput:false, a CV input wires into that param)
// SWITCH / structural params (mode, scale, pattern) are sent via postMessage.
//
// The processor MAY post `{ t:"state", s:{...} }` snapshots (throttled, display
// only); the base caches the latest and exposes getState() for panels — the one
// sanctioned audio→main crossing, never on the timing path.
export class WorkletModule extends AudioModule {
  constructor(ctx, params = {}) {
    super(ctx);
    const Cls = this.constructor;

    // Derive bus indices from declared ports.
    this._outBus = {};
    this._inBus  = {};
    const outs = [];
    let inCount = 0;
    for (const p of (Cls.PORTS || [])) {
      if (p.dir === PORT_DIR.OUT) { this._outBus[p.name] = outs.length; outs.push(p); }
      else                        { this._inBus[p.name]  = inCount++; }
    }

    // Knob controls → worklet AudioParams (the processor reads each value).
    const knobs = (Cls.CONTROLS || []).filter((c) => c.kind === CONTROL_KIND.KNOB);
    this._knobNames = new Set(knobs.map((c) => c.name));

    const parameterData = {};
    for (const name of this._knobNames) {
      if (params[name] != null) parameterData[name] = params[name];
    }

    this.node = new AudioWorkletNode(ctx, Cls.PROCESSOR, {
      numberOfInputs:  inCount,
      numberOfOutputs: outs.length,
      outputChannelCount: outs.map(() => 1),
      parameterData,
    });

    // Each knob with a CV input gets a destination-owned cvRange scaler feeding
    // the matching worklet AudioParam — same contract as native modules, so CV
    // is summed and scaled identically (resolveIn falls through to getCvIn).
    for (const c of knobs) {
      if (c.cvInput === false) continue;
      this._makeCvInput(c.name, c.cvRange ?? 1, this.node.parameters.get(c.name));
    }
    this.node.onprocessorerror = () => {
      console.error(`[worklet] processor "${Cls.PROCESSOR}" crashed`);
    };

    // Snapshot channel (display only).
    this._state = {};
    this.node.port.onmessage = (e) => {
      if (e.data && e.data.t === "state") this._state = e.data.s;
    };

    // Send structural / switch params the processor can't express as AudioParams.
    for (const [name, value] of Object.entries(params || {})) {
      if (!this._knobNames.has(name)) this._postParam(name, value);
    }

    // Keep-alive: a worklet is only pulled while its output reaches the
    // destination. Route output 0 through a muted sink so process() (and the
    // snapshot posts) keep running even when nothing downstream is wired yet.
    if (outs.length > 0) {
      this._keepAlive = ctx.createGain();
      this._keepAlive.gain.value = 0;
      this.node.connect(this._keepAlive, 0).connect(ctx.destination);
    }
  }

  _postParam(name, value) {
    this.node.port.postMessage({ t: "param", name, value });
  }

  setParam(name, value) {
    if (this._knobNames.has(name)) {
      const p = this.node.parameters.get(name);
      if (p) { p.setValueAtTime(value, this.ctx.currentTime); return; }
    }
    this._postParam(name, value);
  }

  // Latest display snapshot posted by the processor (for panels). Never read on
  // the audio/timing path.
  getState() { return this._state; }

  // ---- Unified port resolution (worklet buses + param inputs) ----
  resolveOut(name, type) {
    if (name in this._outBus) return { node: this.node, bus: this._outBus[name] };
    return super.resolveOut(name, type);
  }
  resolveIn(name, type) {
    if (name in this._inBus) return { node: this.node, bus: this._inBus[name] };
    // CV-into-knob inputs fall through to the base getCvIn (the cvRange scaler
    // created above, which targets the worklet AudioParam).
    return super.resolveIn(name, type);
  }

  dispose() {
    try { this.node.port.onmessage = null; } catch {}
    try { this.node.disconnect(); } catch {}
    if (this._keepAlive) { try { this._keepAlive.disconnect(); } catch {} }
    super.dispose();
  }
}
