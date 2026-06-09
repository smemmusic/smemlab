import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY } from "../../audio/graph/types.js";

// Shared base for the envelope family (ADSR / AR / AD). Holds everything the
// three have in common: a CONTROL-kind module with a single gate input and a
// unipolar CV output (0..1 envelope shape), an internal GainNode that runs the
// same ramps purely so the meter's getValue() has something to read, and a
// ConstantSourceNode whose offset carries the normalised shape downstream
// (typically into amp.level for VCA behaviour).
//
// Subclasses provide only what actually differs:
//   - static CONTROLS  — the knob set (a/d/s/r, a/r, a/d). The base reads each
//                        control's `cvRange` to wire one tapped CV input per knob.
//   - _effective()     — sum each knob with its CV-input contribution, clamped.
//   - _onGateOpen()    — schedule the attack(/decay/sustain) ramps + set phase.
//   - _onGateClose()   — schedule the release (inherited no-op for one-shot AD).
// Optional hooks for legacy patch keys: _migrateParams() / _aliasParam().
export class EnvelopeModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, params) {
    super(ctx);
    this.params = this._migrateParams({ ...params });

    // Internal gain — drives the meter readout only; not exposed as audio.
    this.node = ctx.createGain();
    this.node.gain.value = 1;

    this.envPhase = "idle";
    this.envStart = 0;

    // Normalised CV-out: offset ramps linearly in [0, 1] so a downstream
    // dB-range destination gets a perceptually-linear envelope. The dB
    // mapping itself lives in each subclass's scheduling.
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 0;
    this.cvOut.start();
    this._gateSources = new Set();

    this._registerCvOut("env", this.cvOut);
    this._registerGateInput("trigger", (sourceId, active) => this._handleGate(sourceId, active));

    // One tapped CV input per knob, sampled at trigger time and added to the
    // scheduled ramps for that cycle. (Mid-cycle modulation isn't supported —
    // once the curve is scheduled it commits.)
    for (const c of this.constructor.CONTROLS) {
      this._makeCvInput(c.name, c.cvRange, null, { tap: true });
    }
  }

  // ── shared lifecycle / accessors ───────────────────────────────
  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  setParam(name, value) {
    name = this._aliasParam(name);
    if (this.constructor.CONTROLS.some((c) => c.name === name)) {
      this.setParams({ [name]: value });
    }
  }

  reset() {
    const t = this.ctx.currentTime;
    this.node.gain.cancelScheduledValues(t);
    this.node.gain.setValueAtTime(1, t);
    this.cvOut.offset.cancelScheduledValues(t);
    this.cvOut.offset.setValueAtTime(0, t);
    this.envPhase = "idle";
    this._gateSources.clear();
  }

  dispose() {
    try { this.cvOut.stop(); } catch {}
    try { this.cvOut.disconnect(); } catch {}
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }

  // ── gate handling ──────────────────────────────────────────────
  // Track gate sources so concurrent gates don't double-fire; only the
  // rising/falling edge of "any source held" reaches the subclass hooks.
  _handleGate(sourceId, active) {
    const wasOpen = this._gateSources.size > 0;
    if (active) this._gateSources.add(sourceId);
    else        this._gateSources.delete(sourceId);
    const nowOpen = this._gateSources.size > 0;
    if (!wasOpen && nowOpen)      this._onGateOpen();
    else if (wasOpen && !nowOpen) this._onGateClose();
  }

  // ── subclass hooks (override) ──────────────────────────────────
  _migrateParams(p) { return p; }
  _aliasParam(name) { return name; }
  _onGateOpen()  {}
  _onGateClose() {}
}
