import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "./graph/types.js";

// Abstract base class for an audio module. Every per-type module class in
// `src/modules/<type>/module.js` extends this and declares:
//   static KIND     — MODULE_KIND.AUDIO | MODULE_KIND.CONTROL
//   static PORTS    — explicit non-CV-input port declarations (audio/gate, plus
//                     CV outputs and PITCH ports). CV *inputs* are auto-derived
//                     from CONTROLS.
//   static CONTROLS — knobs/switches. Each entry auto-generates a CV input port
//                     of the same name with a destination-owned scaler, unless
//                     marked `cvInput: false`.
//
// Public typed-port API used by GraphEngine + the bridge:
//   getAudioIn(name)  / getAudioOut(name) → AudioNode | AudioParam | null
//   getCvIn(name)     / getCvOut(name)    → AudioNode | AudioParam | null
//   getPitchIn(name)  / getPitchOut(name) → AudioNode | AudioParam | null
//   getGateIn(name)   / getGateOut(name)  → AudioNode | null (gate = 0/1 signal)
//   resolveOut/resolveIn(name, type)      → { node, bus } for the engine to wire
//   setParam(name, value)                 — generic param dispatcher
//   listPorts()                           — combined static PORTS + auto CV inputs
//   getCvLevel(name)                      — post-mix CV sample (tapped inputs only)
//
// Gates are audio-rate 0/1 signals like any other port — control logic that
// reacts to them lives in AudioWorkletProcessors (see WorkletModule). The
// default getters look up the port name in the registries the base class
// maintains: `_audioPorts`, `_cvPorts`, `_pitchPorts`, `_gatePorts`.
// Subclasses populate these in their constructor via `_register*` and `_makeCvInput`.

export class AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [];
  static CONTROLS = [];

  constructor(ctx) {
    this.ctx = ctx;
    this._audioPorts = { in: {}, out: {} };
    this._cvPorts    = { in: {}, out: {} };  // .in[name] = { scaler, range, target, analyser? }
    this._pitchPorts = { in: {}, out: {} };
    this._gatePorts  = { in: {}, out: {} };  // audio-rate 0/1 gate signal nodes (native sources)
    // Opt-in flag — when true, the engine adds this module to its per-frame
    // poller set and calls `_onPollFrame(onChange, isConnected)` each rAF tick.
    // Used for discrete switch-input detection and the amp's meter readout —
    // never for a continuous signal (those all run on the audio thread).
    this._pollOnFrame = false;
  }

  // ---- Typed-port API ----

  getAudioIn(name)  { return this._audioPorts.in[name]  ?? null; }
  getAudioOut(name) { return this._audioPorts.out[name] ?? null; }
  getCvIn(name)     { return this._cvPorts.in[name]?.scaler ?? null; }
  getCvOut(name)    { return this._cvPorts.out[name] ?? null; }
  getPitchIn(name)  { return this._pitchPorts.in[name]  ?? null; }
  getPitchOut(name) { return this._pitchPorts.out[name] ?? null; }
  getGateIn(name)   { return this._gatePorts.in[name]  ?? null; }
  getGateOut(name)  { return this._gatePorts.out[name] ?? null; }

  // Unified port resolution used by the engine to wire connections of ANY type
  // through a single audio-graph path. Returns { node, bus } where `node` is an
  // AudioNode or AudioParam and `bus` is the input/output bus index (0 for
  // native single-node ports; worklet modules override to return their bus).
  // Gate is just an audio-rate 0/1 signal here — no special main-thread path.
  resolveOut(name, type) {
    let node = null;
    if      (type === PORT_TYPE.AUDIO) node = this.getAudioOut(name);
    else if (type === PORT_TYPE.CV)    node = this.getCvOut(name);
    else if (type === PORT_TYPE.PITCH) node = this.getPitchOut(name);
    else if (type === PORT_TYPE.GATE)  node = this.getGateOut(name);
    return node ? { node, bus: 0 } : null;
  }
  resolveIn(name, type) {
    let node = null;
    if      (type === PORT_TYPE.AUDIO) node = this.getAudioIn(name);
    else if (type === PORT_TYPE.CV)    node = this.getCvIn(name);
    else if (type === PORT_TYPE.PITCH) node = this.getPitchIn(name);
    else if (type === PORT_TYPE.GATE)  node = this.getGateIn(name);
    return node ? { node, bus: 0 } : null;
  }

  // Combined view: explicit static PORTS + auto-generated CV inputs from CONTROLS.
  // Controls with `cvInput: false` skip the auto-generated port (used by dense
  // modules like the CV mixer where every knob would clutter the layout).
  listPorts() {
    const ctor = this.constructor;
    const cvInputs = (ctor.CONTROLS || [])
      .filter((c) => c.cvInput !== false)
      .map((c) => ({
        name: c.name,
        dir:  PORT_DIR.IN,
        type: PORT_TYPE.CV,
        polarity: c.cvPolarity,
        description: c.description,
        auto: true,
      }));
    return [...(ctor.PORTS || []), ...cvInputs];
  }

  // Default param dispatcher. Subclasses override.
  setParam(name, value) { this[`_set_${name}`]?.(value); }

  // ---- Port registration helpers (called by subclass constructors) ----

  _registerAudioIn(name, nodeOrParam)  { this._audioPorts.in[name]  = nodeOrParam; }
  _registerAudioOut(name, node)        { this._audioPorts.out[name] = node; }
  _registerCvOut(name, node)           { this._cvPorts.out[name]    = node; }
  // Native gate-signal output (manual sources: trigger button, keyboard). The
  // node carries an audio-rate 0/1 signal toggled by human input at currentTime.
  _registerGateOut(name, node)         { this._gatePorts.out[name]  = node; }
  _registerPitchIn(name, nodeOrParam)  { this._pitchPorts.in[name]  = nodeOrParam; }
  _registerPitchOut(name, node)        { this._pitchPorts.out[name] = node; }

  // Build a destination-owned CV-input scaler: a GainNode whose gain = cvRange
  // and whose output connects to `target` (an AudioParam, or an AudioNode for
  // further processing). Sources connect into the scaler's input; multiple
  // sources sum at the GainNode automatically. Returns the scaler.
  //
  // Pass `{ tap: true }` to also fan the scaler output into a dedicated
  // AnalyserNode, exposing the live post-mix CV contribution via getCvLevel().
  // Pass `{ tap: true, vizOnly: true }` for taps that exist *only* for panel
  // visuals — the engine disconnects these from the audio graph when the
  // global visuals toggle is off. Switch-CV taps and the amp's level tap are
  // load-bearing for audio behaviour and must omit `vizOnly`.
  _makeCvInput(name, cvRange, target, { tap = false, vizOnly = false } = {}) {
    const scaler = this.ctx.createGain();
    scaler.gain.value = cvRange;
    if (target) scaler.connect(target);
    let analyser = null;
    if (tap) {
      analyser = this.ctx.createAnalyser();
      analyser.fftSize = 256;
      scaler.connect(analyser);
    }
    this._cvPorts.in[name] = { scaler, range: cvRange, target, analyser, vizOnly };
    return scaler;
  }

  // Returns the current post-mix CV value at a tapped input (mean of the
  // analyser's last frame). Returns 0 for non-tapped or unknown inputs.
  getCvLevel(name) {
    const entry = this._cvPorts.in[name];
    if (!entry?.analyser) return 0;
    if (!entry._tapBuf) entry._tapBuf = new Float32Array(entry.analyser.fftSize);
    entry.analyser.getFloatTimeDomainData(entry._tapBuf);
    let sum = 0;
    for (let i = 0; i < entry._tapBuf.length; i++) sum += entry._tapBuf[i];
    return sum / entry._tapBuf.length;
  }

  // Register a CV input that quantises incoming voltage to a discrete switch
  // value. The engine's poll loop reads the tap, quantises, and fires changes
  // back into the store via the bridge.
  _makeSwitchInput(name, values, cvRange = 1) {
    this._makeCvInput(name, cvRange, null, { tap: true });
    if (!this._switchInputs) this._switchInputs = new Map();
    this._switchInputs.set(name, { values, lastIdx: -1 });
    this._pollOnFrame = true;
  }

  // Per-frame hook called by the engine's poll loop on every module that opted
  // in via `_pollOnFrame = true`. Default: poll switch CVs. Subclasses with
  // additional per-frame work (e.g. amp CV → gain) override and call super.
  _onPollFrame(onChange, isConnected) {
    this._pollSwitches(onChange, isConnected);
  }

  // Called by `_onPollFrame`. For each switch input, reads the tapped
  // CV, quantises to a values[] index, fires `onChange` when the index moves.
  // Skips switches with no incoming connection to avoid locking to values[0].
  // Quantisation uses abs() so unipolar and bipolar sources both sweep all options.
  _pollSwitches(onChange, isConnected) {
    if (!this._switchInputs) return;
    for (const [name, spec] of this._switchInputs) {
      if (!isConnected(this.id, name)) {
        spec.lastIdx = -1;
        continue;
      }
      const cv = this.getCvLevel(name);
      const norm = Math.min(1, Math.abs(cv));
      const idx = Math.min(spec.values.length - 1, Math.floor(norm * spec.values.length));
      if (idx !== spec.lastIdx) {
        spec.lastIdx = idx;
        onChange(this.id, name, spec.values[idx]);
      }
    }
  }

  // ---- Visuals enable/disable ----

  // Subclasses with a signal-path analyser used purely for panel visuals
  // (oscilloscope on the oscillator, master tap on the output) call this in
  // their constructor with `(passthrough, analyser)`: a side-branch from the
  // passthrough node into the analyser. The base walker connects / disconnects
  // that branch when global visuals are toggled.
  _registerDisplayTap(source, analyser) {
    if (!this._displayTaps) this._displayTaps = [];
    this._displayTaps.push({ source, analyser });
  }

  // Connect (enabled=true) or disconnect (enabled=false) every viz-only
  // analyser side-branch on this module. Idempotent — safe to call repeatedly
  // with the same value. Skips load-bearing CV taps (vizOnly=false), so switch
  // quantisation and the amp's CV-driven gain keep working.
  setVisualsEnabled(enabled) {
    for (const entry of Object.values(this._cvPorts.in)) {
      if (!entry.analyser || !entry.vizOnly) continue;
      if (enabled) {
        try { entry.scaler.connect(entry.analyser); } catch {}
      } else {
        try { entry.scaler.disconnect(entry.analyser); } catch {}
      }
    }
    if (this._displayTaps) {
      for (const { source, analyser } of this._displayTaps) {
        if (enabled) {
          try { source.connect(analyser); } catch {}
        } else {
          try { source.disconnect(analyser); } catch {}
        }
      }
    }
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
