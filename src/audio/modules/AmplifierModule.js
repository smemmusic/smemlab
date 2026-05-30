import { AudioModule } from "./AudioModule.js";
import { dbToLin } from "../constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

// Manual gain stage. When the amp block is inactive, the gain stays at 1 (0 dB pass-through).
export class AmplifierModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "input",  dir: PORT_DIR.IN,  type: PORT_TYPE.AUDIO },
    { name: "output", dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    // level: dB. cvRange = 48 dB so unipolar 0..1 sweeps the full DB_FLOOR..0 range.
    { name: "level", kind: CONTROL_KIND.KNOB, range: [-48, 0], curve: CONTROL_CURVE.LINEAR,
      cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { db, active }) {
    super(ctx);
    this.node = ctx.createGain();
    this.active = active;
    this.db = db;
    this.node.gain.value = active ? dbToLin(db) : 1;

    // ---- typed-port registration ----
    this._registerAudioIn("input",   this.node);
    this._registerAudioOut("output", this.node);
    // CV in "level" — unipolar 0..1 maps to ±48 dB-worth of *linear* gain
    // modulation. Note: gain modulation is multiplicative on the audio path,
    // not dB-additive — accurate dB-CV would need a curve, deferred.
    this._makeCvInput("level", 1, this.node.gain);
  }
  get input()  { return this.node; }
  get output() { return this.node; }

  setActive(active) {
    this.active = active;
    this.node.gain.setTargetAtTime(active ? dbToLin(this.db) : 1, this.ctx.currentTime, 0.01);
  }
  setDb(db) {
    this.db = db;
    if (this.active) this.node.gain.setTargetAtTime(dbToLin(db), this.ctx.currentTime, 0.01);
  }

  // ---- typed-port setParam dispatch ----
  // Accepts both the typed-port CV-input name ("level") and the legacy store
  // slot key ("db"). Free-mode wires use "level"; the chapter-mode store
  // still writes {db}.
  setParam(name, value) {
    if (name === "level" || name === "db") this.setDb(value);
  }

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
