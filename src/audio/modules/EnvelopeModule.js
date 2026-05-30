import { AudioModule } from "./AudioModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

// VCA module gated by an ADSR. Idle gain = 1 (0 dB) so the amp's offset passes through.
// noteOn ramps to a peak at ENV_PEAK_BOOST_DB above amp, decays to peak+sustainDb,
// noteOff releases back to idle (1.0).
export class EnvelopeModule extends AudioModule {
  // The envelope is dual-role: a VCA in the audio path AND a unipolar CV source.
  // Per the plan it's a "control" module that *also* exposes audio I/O ports.
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
    { name: "input",   dir: PORT_DIR.IN,  type: PORT_TYPE.AUDIO },
    { name: "output",  dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    { name: "a",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "sustainDb", kind: CONTROL_KIND.KNOB, range: [-48, 0],   curve: CONTROL_CURVE.LINEAR, cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, params) {
    super(ctx);
    this.params = { ...params };       // { a, d, sustainDb, r }
    this.node = ctx.createGain();
    this.node.gain.value = 1;
    this.envPhase = "idle";
    this.envStart = 0;

    // Parallel CV-out shadow: a ConstantSourceNode whose offset is scheduled
    // alongside the VCA's gain ramps but normalised to the [0,1] envelope
    // shape (0 idle, 1 peak, sustainLin sustain, 0 release-end). This is the
    // signal the typed-port `env:cv` output emits. The VCA itself stays on
    // its absolute boost curve so the legacy audio path is unchanged.
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 0;
    this.cvOut.start();
    // Per-source gate tracking. Multiple gate sources may be wired (keyboard +
    // gate button + sequencer); the envelope opens on first-active and closes
    // on last-released. `_gateSources` is the set of currently-active source IDs.
    this._gateSources = new Set();

    // ---- typed-port registration ----
    this._registerAudioIn("input",   this.node);
    this._registerAudioOut("output", this.node);
    this._registerCvOut("env",       this.cvOut);
    this._registerGateInput("trigger", (sourceId, active) => this._handleGate(sourceId, active));
    // CV inputs for the A/D/S/R knobs. The envelope params are scheduled
    // (not AudioParam-driven), so the scaler outputs go nowhere — connections
    // are accepted but actual modulation of envelope params is deferred to a
    // future polling read.
    this._makeCvInput("a",         4,  null);
    this._makeCvInput("d",         4,  null);
    this._makeCvInput("sustainDb", 48, null);
    this._makeCvInput("r",         4,  null);
  }
  get input()  { return this.node; }
  get output() { return this.node; }

  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  noteOn() {
    const t = this.ctx.currentTime;
    const e = this.params;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB + e.sustainDb), t + e.a + e.d);
    // Parallel normalised CV ramp: idle → 1 → sustainLin (0..1).
    const cv = this.cvOut.offset;
    const sustainLin01 = dbToLin(e.sustainDb);  // sustainDb is <= 0, so 0..1
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(Math.max(1e-5, cv.value), t);
    cv.exponentialRampToValueAtTime(1.0, t + e.a);
    cv.exponentialRampToValueAtTime(Math.max(1e-5, sustainLin01), t + e.a + e.d);
    this.envStart = performance.now();
    this.envPhase = "ad";
  }
  noteOff() {
    const t = this.ctx.currentTime;
    const e = this.params;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(1.0, t + e.r);
    // Parallel normalised CV release → 0.
    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(Math.max(1e-5, cv.value), t);
    cv.exponentialRampToValueAtTime(1e-5, t + e.r);
    this.envStart = performance.now();
    this.envPhase = "rel";
  }
  reset() {
    const t = this.ctx.currentTime;
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1, t);
    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(0, t);
    this.envPhase = "idle";
    this._gateSources.clear();
  }

  // Multi-source gate handler. Opens on first-active, closes on last-released.
  _handleGate(sourceId, active) {
    const wasOpen = this._gateSources.size > 0;
    if (active) this._gateSources.add(sourceId);
    else        this._gateSources.delete(sourceId);
    const nowOpen = this._gateSources.size > 0;
    if (!wasOpen && nowOpen) this.noteOn();
    else if (wasOpen && !nowOpen) this.noteOff();
  }

  // ---- typed-port setParam dispatch ----
  setParam(name, value) {
    if (["a", "d", "sustainDb", "r"].includes(name)) {
      this.setParams({ [name]: value });
    }
  }

  dispose() {
    try { this.cvOut.stop(); } catch {}
    try { this.cvOut.disconnect(); } catch {}
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
