import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";

// Manual gate source. Its `gate` output is an audio-rate 0/1 signal carried by a
// ConstantSource: the panel button (or the assigned key) sets the offset to 1
// while held and 0 on release, committed at currentTime. That is the one
// sanctioned main→audio crossing — human input has no precise intended time —
// and from there the gate flows entirely on the audio thread like any signal.
export class TriggerModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "gate", dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.gateOut = ctx.createConstantSource();
    this.gateOut.offset.value = 0;
    this.gateOut.start();
    this._registerGateOut("gate", this.gateOut);
  }

  // Called by the panel on press / release.
  setGate(active) {
    this.gateOut.offset.setValueAtTime(active ? 1 : 0, this.ctx.currentTime);
  }

  setParam() {}

  dispose() {
    try { this.gateOut.stop(); } catch {}
    try { this.gateOut.disconnect(); } catch {}
    super.dispose();
  }
}
