import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin, ENV_PEAK_BOOST_DB } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// AD envelope — percussive, one-shot. A gate transition 0 → 1 starts an
// attack-then-decay cycle of fixed length (a + d); gate length is otherwise
// ignored. Re-triggering during a running cycle restarts from the current
// value (no click). Same dB-space CV-out contract as ADSR/AR: 0 = silence,
// 1 = peak.
export class AdEnvelopeModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "trigger", dir: PORT_DIR.IN,  type: PORT_TYPE.GATE },
    { name: "env",     dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.UNIPOLAR },
  ];
  static CONTROLS = [
    { name: "a", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
    { name: "d", kind: CONTROL_KIND.KNOB, range: [0.001, 4], curve: CONTROL_CURVE.EXP, cvRange: 4, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, params) {
    super(ctx);
    this.params = { ...params };
    this.node = ctx.createGain();
    this.node.gain.value = 1;
    this.envPhase = "idle";
    this.envStart = 0;

    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 0;
    this.cvOut.start();
    this._gateSources = new Set();

    this._registerCvOut("env", this.cvOut);
    this._registerGateInput("trigger", (sourceId, active) => this._handleGate(sourceId, active));
    // Tapped so the envelope can sample the CV at trigger time and add
    // its contribution to the scheduled ramps for that cycle.
    this._makeCvInput("a", 4, null, { tap: true });
    this._makeCvInput("d", 4, null, { tap: true });
  }

  _effective() {
    const e = this.params;
    return {
      a: Math.max(0.001, e.a + this.getCvLevel("a")),
      d: Math.max(0.001, e.d + this.getCvLevel("d")),
    };
  }

  setParams(partial) { this.params = { ...this.params, ...partial }; }
  getValue()         { return this.node.gain.value; }
  getPhase()         { return this.envPhase; }
  getStart()         { return this.envStart; }

  // Trigger: schedule the whole A→D cycle in one shot. Gate-down does
  // nothing — that's the whole point of "no sustain".
  trigger() {
    const t = this.ctx.currentTime;
    const e = this._effective();

    // Internal gain (meter readout): boost to peak then back to unity.
    const g = this.node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(1e-5, g.value), t);
    g.exponentialRampToValueAtTime(dbToLin(ENV_PEAK_BOOST_DB), t + e.a);
    g.exponentialRampToValueAtTime(1.0,                          t + e.a + e.d);

    // CV-out: 0 → peak (attack), then peak → 0 (decay).
    const cv = this.cvOut.offset;
    cv.cancelScheduledValues(t);
    cv.setValueAtTime(cv.value, t);
    cv.linearRampToValueAtTime(1.0, t + e.a);
    cv.linearRampToValueAtTime(0,   t + e.a + e.d);

    this.envStart = performance.now();
    this.envPhase = "ad";
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
    // Track sources so concurrent gates don't double-trigger. Only the
    // rising edge of "any source held" fires the envelope.
    const wasOpen = this._gateSources.size > 0;
    if (active) this._gateSources.add(sourceId);
    else        this._gateSources.delete(sourceId);
    const nowOpen = this._gateSources.size > 0;
    if (!wasOpen && nowOpen) this.trigger();
  }

  setParam(name, value) {
    if (name === "a" || name === "d") {
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
