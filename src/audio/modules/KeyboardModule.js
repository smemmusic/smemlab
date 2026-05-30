import { AudioModule } from "./AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
} from "../graph/types.js";

// Pure control module: emits a V/oct pitch CV and a gate. The panel
// (KeyboardPanel) drives this with playMidi(midi) / release(midi); the
// module updates pitchOut and asks the engine to fan out the gate.
//
// Pitch encoding: value = (midi - 69) / 12 (A4 = 0, +1 per octave). A4 is
// the standard tuning reference (440 Hz), so when the destination oscillator
// is tuned to 440 Hz, pressing A4 lands at detune = 0 and the heard note
// matches. The destination oscillator's `pitch:pitch` input scales by 1200
// cents into its detune AudioParam.
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
  }

  // Update the pitch output to the given MIDI note. Smooth ramp via
  // setTargetAtTime to avoid clicks when sweeping between notes.
  playMidi(midi) {
    const voct = (midi - 69) / 12;
    this.pitchOut.offset.setTargetAtTime(voct, this.ctx.currentTime, 0.003);
  }

  setParam() { /* no params */ }

  dispose() {
    try { this.pitchOut.stop(); } catch {}
    try { this.pitchOut.disconnect(); } catch {}
    super.dispose();
  }
}
