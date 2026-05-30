import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// Manual gain stage. CV input "level" sums into the gain AudioParam linearly;
// envelope or LFO modulation acts as additive boost above the knob's intrinsic
// gain. Tapped so the panel meter shows the live post-mix level.
export class AmplifierModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "input",  dir: PORT_DIR.IN,  type: PORT_TYPE.AUDIO },
    { name: "output", dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    { name: "level", kind: CONTROL_KIND.KNOB, range: [-48, 12], curve: CONTROL_CURVE.LINEAR,
      cvRange: 48, cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { level }) {
    super(ctx);
    this.node = ctx.createGain();
    this.level = level;
    this.node.gain.value = dbToLin(level);

    this._registerAudioIn("input",   this.node);
    this._registerAudioOut("output", this.node);
    this._makeCvInput("level", 1, this.node.gain, { tap: true });
  }

  setLevel(db) {
    this.level = db;
    this.node.gain.setTargetAtTime(dbToLin(db), this.ctx.currentTime, 0.01);
  }

  setParam(name, value) {
    if (name === "level") this.setLevel(value);
  }

  dispose() {
    try { this.node.disconnect(); } catch {}
    super.dispose();
  }
}
