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
//   onGate(portName, sourceId, active)    — gate-input modules override this
//   setParam(name, value)                 — generic param dispatcher
//   listPorts()                           — combined static PORTS + auto CV inputs
//   getCvLevel(name)                      — post-mix CV sample (tapped inputs only)
//
// The default getters look up the port name in the registries the base class
// maintains: `_audioPorts`, `_cvPorts`, `_pitchPorts`, `_gateInputs`.
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
    this._gateInputs = {};                    // name → handler(sourceId, active)
  }

  // ---- Typed-port API ----

  getAudioIn(name)  { return this._audioPorts.in[name]  ?? null; }
  getAudioOut(name) { return this._audioPorts.out[name] ?? null; }
  getCvIn(name)     { return this._cvPorts.in[name]?.scaler ?? null; }
  getCvOut(name)    { return this._cvPorts.out[name] ?? null; }
  getPitchIn(name)  { return this._pitchPorts.in[name]  ?? null; }
  getPitchOut(name) { return this._pitchPorts.out[name] ?? null; }

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
        auto: true,
      }));
    return [...(ctor.PORTS || []), ...cvInputs];
  }

  // Default param dispatcher. Subclasses override.
  setParam(name, value) { this[`_set_${name}`]?.(value); }

  // Gate input plumbing. The engine calls onGate; the subclass registers
  // handlers in its constructor.
  onGate(portName, sourceId, active) { this._gateInputs[portName]?.(sourceId, active); }
  _registerGateInput(name, handler)  { this._gateInputs[name] = handler; }

  // ---- Port registration helpers (called by subclass constructors) ----

  _registerAudioIn(name, nodeOrParam)  { this._audioPorts.in[name]  = nodeOrParam; }
  _registerAudioOut(name, node)        { this._audioPorts.out[name] = node; }
  _registerCvOut(name, node)           { this._cvPorts.out[name]    = node; }
  _registerPitchIn(name, nodeOrParam)  { this._pitchPorts.in[name]  = nodeOrParam; }
  _registerPitchOut(name, node)        { this._pitchPorts.out[name] = node; }

  // Build a destination-owned CV-input scaler: a GainNode whose gain = cvRange
  // and whose output connects to `target` (an AudioParam, or an AudioNode for
  // further processing). Sources connect into the scaler's input; multiple
  // sources sum at the GainNode automatically. Returns the scaler.
  //
  // Pass `{ tap: true }` to also fan the scaler output into a dedicated
  // AnalyserNode, exposing the live post-mix CV contribution via getCvLevel().
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
  }

  // Called by the engine's poll loop. For each switch input, reads the tapped
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

  // ---- Lifecycle ----

  dispose() {
    // Disconnect every registered CV-input scaler. Subclasses still need to
    // dispose their own primary nodes (oscillators, filters, etc).
    for (const entry of Object.values(this._cvPorts.in)) {
      try { entry.scaler.disconnect(); } catch {}
    }
  }
}
