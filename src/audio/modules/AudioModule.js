import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../graph/types.js";

// Abstract base class for an audio module.
//
// LEGACY API (used by the hardcoded AudioEngine, still in production):
//   get input()  — single audio input node (or null)
//   get output() — single audio output node (or null)
//   dispose()    — stop/disconnect owned nodes
//
// TYPED-PORT API (used by the new GraphEngine behind window.__newEngine):
//   static KIND     — MODULE_KIND.AUDIO | MODULE_KIND.CONTROL
//   static PORTS    — explicit non-CV-input port declarations (audio/gate, plus
//                     CV outputs and PITCH ports). CV *inputs* are auto-derived
//                     from CONTROLS.
//   static CONTROLS — knobs/switches. Each entry auto-generates a CV input port
//                     of the same name with a destination-owned scaler.
//
//   getAudioIn(name)  / getAudioOut(name) → AudioNode | AudioParam | null
//   getCvIn(name)     / getCvOut(name)    → AudioNode | AudioParam | null
//   getPitchIn(name)  / getPitchOut(name) → AudioNode | AudioParam | null
//   onGate(portName, sourceId, active)    — gate-input modules override this
//   setParam(name, value)                 — generic param dispatcher
//   listPorts() — combined list of declared + auto-generated CV-input ports
//
// The default getters look up the port name in the registries the base class
// maintains: `_audioPorts`, `_cvPorts`, `_pitchPorts`, `_gatePorts`. Subclasses
// populate these in their constructor (via `_registerPort` and `_makeCvInput`)
// and rarely need to override the getters themselves.

export class AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [];
  static CONTROLS = [];

  constructor(ctx) {
    this.ctx = ctx;
    // Named port → node/param registries. Direction is encoded in the key
    // (e.g. _audioPorts.out["main"] vs _audioPorts.in["input"]).
    this._audioPorts = { in: {}, out: {} };
    this._cvPorts    = { in: {}, out: {} };  // .in[name] = { scaler, range, target }
    this._pitchPorts = { in: {}, out: {} };
    this._gateInputs = {};  // name → handler(sourceId, active)
  }

  // ---- Legacy single-port API (subclasses still implement these for the old engine).
  get input()  { return null; }
  get output() { return null; }

  // ---- Typed-port API ----

  getAudioIn(name)  { return this._audioPorts.in[name]  ?? null; }
  getAudioOut(name) { return this._audioPorts.out[name] ?? null; }
  getCvIn(name)     { return this._cvPorts.in[name]?.scaler ?? null; }
  getCvOut(name)    { return this._cvPorts.out[name] ?? null; }
  getPitchIn(name)  { return this._pitchPorts.in[name]  ?? null; }
  getPitchOut(name) { return this._pitchPorts.out[name] ?? null; }

  // Combined view: explicit static PORTS + auto-generated CV inputs from CONTROLS.
  // The GraphEngine and the UI both query this to know what to render/wire.
  listPorts() {
    const ctor = this.constructor;
    const cvInputs = (ctor.CONTROLS || []).map((c) => ({
      name: c.name,
      dir:  PORT_DIR.IN,
      type: PORT_TYPE.CV,
      polarity: c.cvPolarity,
      auto: true,   // hint: came from CONTROLS, not from PORTS
    }));
    return [...(ctor.PORTS || []), ...cvInputs];
  }

  // Default param dispatcher. Subclasses with knobs/switches override or
  // extend this to apply the value to the underlying nodes.
  setParam(name, value) {
    this[`_set_${name}`]?.(value);
  }

  // Gate input plumbing. The engine calls onGate; the subclass registers
  // handlers in its constructor.
  onGate(portName, sourceId, active) {
    this._gateInputs[portName]?.(sourceId, active);
  }
  _registerGateInput(name, handler) {
    this._gateInputs[name] = handler;
  }

  // ---- Port registration helpers (called by subclass constructors) ----

  _registerAudioIn(name, nodeOrParam)  { this._audioPorts.in[name]  = nodeOrParam; }
  _registerAudioOut(name, node)        { this._audioPorts.out[name] = node; }
  _registerCvOut(name, node)           { this._cvPorts.out[name]    = node; }
  _registerPitchIn(name, nodeOrParam)  { this._pitchPorts.in[name]  = nodeOrParam; }
  _registerPitchOut(name, node)        { this._pitchPorts.out[name] = node; }

  // Build a destination-owned CV-input scaler: a GainNode whose gain = cvRange
  // and whose output connects to `target` (an AudioParam, or an AudioNode for
  // further processing). Sources connect into the scaler's input; multiple
  // sources sum at the GainNode automatically. Returns the scaler so the
  // subclass can hold a reference (rarely needed).
  //
  // Pass `{ tap: true }` to also fan the scaler output into a dedicated
  // AnalyserNode, exposing the live post-mix CV contribution via getCvLevel().
  // Use for inputs whose effect should be reflected in panel visualisers
  // (amp.level → meter, filter.cutoff → response curve, etc.).
  _makeCvInput(name, cvRange, target, { tap = false } = {}) {
    const scaler = this.ctx.createGain();
    scaler.gain.value = cvRange;
    if (target) scaler.connect(target);
    let analyser = null;
    if (tap) {
      analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      scaler.connect(analyser);
    }
    this._cvPorts.in[name] = { scaler, range: cvRange, target, analyser };
    return scaler;
  }

  // Returns the current post-mix CV value at a tapped input (mean of the
  // analyser's last frame). Returns 0 for inputs that weren't created with
  // `tap: true`, or for unknown input names. Cheap enough to poll at
  // requestAnimationFrame cadence.
  getCvLevel(name) {
    const entry = this._cvPorts.in[name];
    if (!entry?.analyser) return 0;
    if (!entry._tapBuf) entry._tapBuf = new Float32Array(entry.analyser.fftSize);
    entry.analyser.getFloatTimeDomainData(entry._tapBuf);
    let sum = 0;
    for (let i = 0; i < entry._tapBuf.length; i++) sum += entry._tapBuf[i];
    return sum / entry._tapBuf.length;
  }

  // ---- Lifecycle ----

  dispose() {
    // Disconnect every registered CV-input scaler. Subclasses still need to
    // dispose their own primary nodes (oscillators, filters, etc).
    for (const entry of Object.values(this._cvPorts.in)) {
      try { entry.scaler.disconnect(); } catch {}
    }
  }
}
