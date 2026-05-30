import { AudioModule } from "./AudioModule.js";
import { dbToLin } from "../constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

// 4-channel CV summing mixer with per-channel gain + phase reverse and a
// master volume. Audio path:
//
//   in1 → ch1Gain ──┐
//   in2 → ch2Gain ──┼─→ masterGain → out
//   in3 → ch3Gain ──┤
//   in4 → ch4Gain ──┘
//
// Each channel's GainNode value is set from { dB, phase }:
//   gain = (phase ? -1 : +1) × dbToLin(db)
// Phase reverse multiplies by -1 so two CVs can cancel or oppose.
// The dB range maps -60..+12. Anything <= -60 → gain = 0 (true silence at
// the "−∞" knob position).
//
// Per-channel knobs intentionally skip auto-CV-inputs (`cvInput: false`) —
// the module already exposes 4 signal inputs + 1 output and adding 9 more
// knob-CV inputs would overflow the port layout. If you want CV-modulated
// channel gain, place an Amplifier before the channel.
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

    // Per-channel gain nodes (also serve as the in1..in4 ports).
    this.channels = [1, 2, 3, 4].map(() => {
      const g = ctx.createGain();
      g.gain.value = dbToLin(0);  // 0 dB pass-through default
      return g;
    });
    this.master = ctx.createGain();
    this.master.gain.value = dbToLin(0);

    for (const ch of this.channels) ch.connect(this.master);

    // Each channel GainNode IS the CV input port — sources connect directly
    // into it. The summed master output is the CV output port.
    for (let i = 0; i < 4; i++) {
      const name = `in${i + 1}`;
      this._cvPorts.in[name] = { scaler: this.channels[i], range: 1, target: null };
    }
    this._registerCvOut("out", this.master);

    // Apply initial param values (handles phase signs + dB conversion).
    this._applyAllGains();
  }

  setParam(name, value) {
    if (!(name in this.params)) return;
    this.params[name] = value;
    if (name === "master") {
      this.master.gain.setTargetAtTime(dbToLin(this._clampDb(value)), this.ctx.currentTime, 0.01);
    } else if (name.startsWith("g") || name.startsWith("p")) {
      const idx = parseInt(name.slice(1), 10) - 1;
      if (idx >= 0 && idx < 4) this._applyChannelGain(idx);
    }
  }

  _clampDb(db) { return db <= -60 ? -Infinity : db; }

  _applyChannelGain(idx) {
    const db = this.params[`g${idx + 1}`];
    const phase = this.params[`p${idx + 1}`];
    // -Infinity → linear 0 (true silence). Otherwise standard dB conversion,
    // negated when phase-reversed.
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
