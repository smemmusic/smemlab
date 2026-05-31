import { AudioModule } from "../../audio/AudioModule.js";
import { DB_FLOOR, dbToLin, ENV_PEAK_BOOST_DB } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Pure control module: gate in, unipolar CV out (0..1 envelope shape).
// Modulates downstream stages by wiring `env:cv` into a CV input (typically
// amp.level for VCA behaviour). An internal GainNode runs the legacy
// gain ramps to drive the meter's getValue() readout; not exposed as audio.
export class EnvelopeModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [
    { name: "a",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "s",         kind: CONTROL_KIND.KNOB, range: [-48, 0],   curve: CONTROL_CURVE.LINEAR, cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "r",         kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP,    cvRange: 4,  cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, params) {
    super(ctx);
    // Backward compat: patches saved before the rename stored the sustain
    // value under `sustainDb`. Map it forward so old patch files still load.
    const p = { ...params };
    if (p.sustainDb !== undefined && p.s === undefined) {
      p.s = p.sustainDb;
    }
    delete p.sustainDb;
    this.params = p;
    this.node = ctx.createGain();
    this.node.gain.value = 1;
    this.envPhase = "idle";
    this.envStart = 0;

    // Normalised CV-out: ConstantSourceNode whose offset ramps *linearly* in
    // [0, 1] so that downstream destinations multiplying by a dB-range constant
    // (e.g. the amp's cv × CV_MAX_DB) get a dB contribution that's linear in
    // time — i.e. perceptually-linear envelope attack/decay/release.
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 0;
    this.cvOut.start();
    this._gateSources = new Set();

    this._registerCvOut("env", this.cvOut);
    this._registerGateInput("trigger", (sourceId, active) => this._handleGate(sourceId, active));
    // ADSR knob CV inputs. Tapped so the envelope can sample them at
    // trigger time and add their contribution to the scheduled ramps for
    // that cycle. (Mid-cycle modulation isn't supported — once the curve
    // is scheduled it commits, matching the existing behaviour of knob
    // changes during a held note.)
    this._makeCvInput("a",         4,  null, { tap: true });
    this._makeCvInput("d",         4,  null, { tap: true });
    this._makeCvInput("s",         48, null, { tap: true });
    this._makeCvInput("r",         4,  null, { tap: true });
  }

  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  // Sum each ADSR knob with its CV-input contribution and clamp to the knob
  // ranges declared in CONTROLS. CV inputs are unipolar so they can only
  // push parameters upward — longer attack/decay/release, less-negative
  // (louder) sustain.
  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      d: Math.max(0.001, e.d + this.getCvLevel("d")),
      s: Math.max(DB_FLOOR, Math.min(0, e.s + this.getCvLevel("s"))),
      r: Math.max(0.001, e.r + this.getCvLevel("r")),
    };
  }

  noteOn() {
    const t = this.ctx.currentTime;
    const e = this._effective();
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB + e.s), t + e.a + e.d);
    const cv = this.cvOut.offset;
    // s (sustain) lives in [DB_FLOOR, 0] dB; map to a normalised [0, 1]
    // position in dB space so a downstream dB-CV input (e.g. amp's
    // `cv × CV_MAX_DB`, where CV_MAX_DB matches |DB_FLOOR|) lands at the
    // envelope's intended sustain dB at the destination. Using dbToLin here
    // was the old bug: it produced a linear-amplitude value that the amp
    // then re-scaled as if it were dB, giving e.g. sustain −3 dB → −14 dB.
    const sustainNorm = (e.s - DB_FLOOR) / -DB_FLOOR;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(1.0, t + e.a);
    cv.linearRampToValueAtTime(sustainNorm, t + e.a + e.d);
    this.envStart = performance.now();
    this.envPhase = "ad";
  }
  noteOff() {
    const t = this.ctx.currentTime;
    const e = this._effective();
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(1.0, t + e.r);
    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(0, t + e.r);
    this.envStart = performance.now();
    this.envPhase = "rel";
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

  _handleGate(sourceId, active) {
    const wasOpen = this._gateSources.size > 0;
    if (active) this._gateSources.add(sourceId);
    else        this._gateSources.delete(sourceId);
    const nowOpen = this._gateSources.size > 0;
    if (!wasOpen && nowOpen) this.noteOn();
    else if (wasOpen && !nowOpen) this.noteOff();
  }

  setParam(name, value) {
    // Accept the legacy `sustainDb` key so the bridge can still push values
    // arriving from an unmigrated store / patch file.
    if (name === "sustainDb") name = "s";
    if (["a", "d", "s", "r"].includes(name)) {
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
