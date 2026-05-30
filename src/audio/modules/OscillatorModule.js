import { AudioModule } from "./AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../graph/types.js";

// Source module: drives a tap analyser. The actual source is either an
// OscillatorNode (for sine/saw/square/triangle) or an AudioBufferSourceNode
// playing 2 s of white noise on loop (for noise). The two node kinds have
// different APIs, so changing `type` between an oscillator kind and noise
// requires swapping the source node entirely.
export class OscillatorModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "main",  dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
    // V/oct pitch tracking (keyboard, sequencer). Drives `detune` so multiple
    // pitch sources sum naturally. When wired, the `freq` knob (still
    // mappable via its auto-generated `freq:cv` input) acts as transpose.
    { name: "pitch", dir: PORT_DIR.IN,  type: PORT_TYPE.PITCH },
  ];
  static CONTROLS = [
    // freq: ±4800 cents (≈±4 octaves) at full bipolar CV. Exp curve so a
    // linear knob maps musically.
    { name: "freq", kind: CONTROL_KIND.KNOB,   range: [20, 20000], curve: CONTROL_CURVE.EXP,
      cvRange: 4800, cvPolarity: CV_POLARITY.BIPOLAR },
    // type: discrete waveforms; quantised on CV input.
    { name: "type", kind: CONTROL_KIND.SWITCH, values: ["sine", "sawtooth", "square", "triangle", "noise"],
      cvRange: 1,   cvPolarity: CV_POLARITY.UNIPOLAR },
  ];

  constructor(ctx, { type, freq }) {
    super(ctx);
    this.type = type;
    this.freq = freq;
    this.tap = ctx.createAnalyser();
    this.tap.fftSize = 2048;
    this.node = this._buildSource(type);
    this.node.connect(this.tap);
    this._started = false;
  }
  get input()  { return null; }
  get output() { return this.tap; }

  start() {
    if (this._started) return;
    this.node.start();
    this._started = true;
  }

  setType(type) {
    if (type === this.type) return;
    const wasNoise = this.type === "noise";
    const willBeNoise = type === "noise";
    this.type = type;

    if (wasNoise === willBeNoise) {
      // Same kind (osc → osc) — just retune; OscillatorNode.type is mutable.
      if (!willBeNoise) this.node.type = type;
      return;
    }
    // Kind change — tear down and rebuild the source node.
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    this.node = this._buildSource(type);
    this.node.connect(this.tap);
    if (this._started) this.node.start();
  }

  setFreq(f) {
    this.freq = f;
    // Noise has no pitch; BufferSourceNode has no .frequency AudioParam.
    if (this.type !== "noise") {
      this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01);
    }
  }

  dispose() {
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    try { this.tap.disconnect(); } catch {}
  }

  // ---- private
  _buildSource(type) {
    if (type === "noise") {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      return src;
    }
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = this.freq;
    return o;
  }
}
