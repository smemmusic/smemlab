import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
} from "../../audio/graph/types.js";

// Pure control module: emits a V/oct pitch CV and a gate, both audio-rate
// signals carried by ConstantSources. The panel (KeyboardPanel) drives pitch via
// playMidi(midi) and the gate via setGate(active) on key down/up — committed at
// currentTime (the sanctioned main→audio crossing for human input); the signals
// then flow entirely on the audio thread.
//
// Pitch encoding: value = (midi - 69) / 12 (A4 = 0, +1 per octave). When the
// destination oscillator is tuned to 440 Hz, pressing A4 lands at detune = 0
// so the heard note matches. The destination's `pitch:pitch` input scales by
// 1200 cents into its detune AudioParam.
export class KeyboardModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "pitch", dir: PORT_DIR.OUT, type: PORT_TYPE.PITCH, polarity: CV_POLARITY.BIPOLAR },
    { name: "gate",  dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    this.pitchOut = ctx.createConstantSource();
    this.pitchOut.offset.value = 0;
    this.pitchOut.start();
    this._registerPitchOut("pitch", this.pitchOut);

    this.gateOut = ctx.createConstantSource();
    this.gateOut.offset.value = 0;
    this.gateOut.start();
    this._registerGateOut("gate", this.gateOut);
  }

  playMidi(midi) {
    const voct = (midi - 69) / 12;
    this.pitchOut.offset.setTargetAtTime(voct, this.ctx.currentTime, 0.003);
  }

  setGate(active) {
    this.gateOut.offset.setValueAtTime(active ? 1 : 0, this.ctx.currentTime);
  }

  setParam() {}

  dispose() {
    try { this.pitchOut.stop(); } catch {}
    try { this.pitchOut.disconnect(); } catch {}
    try { this.gateOut.stop(); } catch {}
    try { this.gateOut.disconnect(); } catch {}
    super.dispose();
  }
}
