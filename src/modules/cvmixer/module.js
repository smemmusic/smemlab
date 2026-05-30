import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// 4-channel CV summing mixer with per-channel gain + phase reverse and a
// master volume. Audio path:
//
//   in1 → ch1Gain ──┐
//   in2 → ch2Gain ──┼─→ masterGain → out
//   in3 → ch3Gain ──┤
//   in4 → ch4Gain ──┘
//
// gain per channel = (phase ? -1 : +1) × dbToLin(db). dB range -60..+12;
// anything ≤ -60 → linear 0 (true silence at "−∞"). Per-channel knobs use
// `cvInput: false` so they don't each spawn a CV port and crowd the layout.
export class CvMixerModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "in1", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in2", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in3", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "in4", dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR },
  ];
  static CONTROLS = [
    { name: "g1",     kind: CONTROL_KIND.KNOB,   range: [-60, 12], curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
    { name: "g2",     kind: CONTROL_KIND.KNOB,   range: [-60, 12], curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
    { name: "g3",     kind: CONTROL_KIND.KNOB,   range: [-60, 12], curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
    { name: "g4",     kind: CONTROL_KIND.KNOB,   range: [-60, 12], curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
    { name: "p1",     kind: CONTROL_KIND.SWITCH, values: [false, true], cvInput: false },
    { name: "p2",     kind: CONTROL_KIND.SWITCH, values: [false, true], cvInput: false },
    { name: "p3",     kind: CONTROL_KIND.SWITCH, values: [false, true], cvInput: false },
    { name: "p4",     kind: CONTROL_KIND.SWITCH, values: [false, true], cvInput: false },
    { name: "master", kind: CONTROL_KIND.KNOB,   range: [-60, 12], curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.UNIPOLAR, cvInput: false },
  ];

  constructor(ctx, params = {}) {
    super(ctx);
    this.params = {
      g1: 0, g2: 0, g3: 0, g4: 0,
      p1: false, p2: false, p3: false, p4: false,
      master: 0,
      ...params,
    };

    this.channels = [1, 2, 3, 4].map(() => {
      const g = ctx.createGain();
      g.gain.value = dbToLin(0);
      return g;
    });
    this.master = ctx.createGain();
    this.master.gain.value = dbToLin(0);
    for (const ch of this.channels) ch.connect(this.master);

    for (let i = 0; i < 4; i++) {
      this._cvPorts.in[`in${i + 1}`] = { scaler: this.channels[i], range: 1, target: null };
    }
    this._registerCvOut("out", this.master);

    this._applyAllGains();
  }

  setParam(name, value) {
    if (!(name in this.params)) return;
    this.params[name] = value;
    if (name === "master") {
      this.master.gain.setTargetAtTime(this.params.master <= -60 ? 0 : dbToLin(value), this.ctx.currentTime, 0.01);
    } else if (name.startsWith("g") || name.startsWith("p")) {
      const idx = parseInt(name.slice(1), 10) - 1;
      if (idx >= 0 && idx < 4) this._applyChannelGain(idx);
    }
  }

  _applyChannelGain(idx) {
    const db = this.params[`g${idx + 1}`];
    const phase = this.params[`p${idx + 1}`];
    const lin = db <= -60 ? 0 : dbToLin(db);
    const signed = phase ? -lin : lin;
    this.channels[idx].gain.setTargetAtTime(signed, this.ctx.currentTime, 0.01);
  }

  _applyAllGains() {
    for (let i = 0; i < 4; i++) this._applyChannelGain(i);
    this.master.gain.value = this.params.master <= -60 ? 0 : dbToLin(this.params.master);
  }

  dispose() {
    for (const ch of this.channels) { try { ch.disconnect(); } catch {} }
    try { this.master.disconnect(); } catch {}
    super.dispose();
  }
}
