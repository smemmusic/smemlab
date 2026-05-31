import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

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
    // pitch sources sum naturally. When wired, the `freq` knob acts as transpose.
    { name: "pitch", dir: PORT_DIR.IN,  type: PORT_TYPE.PITCH,
      description: "V/oct pitch tracking (1V = +1 octave)" },
    // Free-modulation CV input: bipolar source sweeps the pitch ±4 octaves
    // around the freq knob. For vibrato, FM, sweeps. (For per-note pitch use
    // the `pitch` port instead — its V/oct calibration tracks keyboards.)
    { name: "mod",   dir: PORT_DIR.IN,  type: PORT_TYPE.CV, polarity: CV_POLARITY.BIPOLAR,
      description: "free pitch modulation (±1 CV → ±4 octaves)" },
  ];
  static CONTROLS = [
    // The freq knob owns the baseline pitch. CV modulation arrives via the
    // explicit `mod` port above (renamed from the old auto-generated `freq`
    // CV input — `freq` vs `pitch` was confusing).
    { name: "freq", kind: CONTROL_KIND.KNOB,   range: [20, 20000], curve: CONTROL_CURVE.EXP,
      cvInput: false },
    { name: "type", kind: CONTROL_KIND.SWITCH, values: ["sine", "sawtooth", "square", "triangle", "noise"],
      cvRange: 1,   cvPolarity: CV_POLARITY.UNIPOLAR,
      description: "wave shape (0V → sine, 1V → noise)" },
    { name: "octave", kind: CONTROL_KIND.SWITCH, values: [-2, -1, 0, 1, 2],
      cvRange: 1,   cvPolarity: CV_POLARITY.UNIPOLAR,
      description: "octave offset (0V → -2, 1V → +2)" },
  ];

  constructor(ctx, { type, freq, octave = 0 }) {
    super(ctx);
    this.type = type;
    this.freq = freq;
    this.octave = octave;
    // `passthrough` is the registered audio out; `tap` is a side-branch the
    // engine can disconnect when visuals are off without silencing the chain.
    this.passthrough = ctx.createGain();
    this.passthrough.gain.value = 1;
    this.tap = ctx.createAnalyser();
    this.tap.fftSize = 2048;
    this.passthrough.connect(this.tap);
    this.node = this._buildSource(type);
    this.node.connect(this.passthrough);
    this._started = false;

    // Octave transpose. A ConstantSourceNode emits (octave × 1200) cents and
    // sums into the oscillator's `detune` alongside the pitch and freq-CV
    // scalers — addition on the same AudioParam is the "applied after the
    // sum" semantics. Disconnected (no-op) when source is noise.
    this.octaveOffset = ctx.createConstantSource();
    this.octaveOffset.offset.value = octave * 1200;
    this.octaveOffset.start();

    this._registerAudioOut("main", this.passthrough);
    this._registerDisplayTap(this.passthrough, this.tap);
    this._bindPitchTarget();
    this._bindModCvTarget();
    this._bindOctaveTarget();
    // Octave switch CV — register once at construction (independent of source
    // type, so external wires don't break when the user switches osc/noise).
    this._makeSwitchInput("octave", [-2, -1, 0, 1, 2], 1);
  }

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
      if (!willBeNoise) this.node.type = type;
      return;
    }
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    this.node = this._buildSource(type);
    this.node.connect(this.passthrough);
    if (this._started) this.node.start();
    this._bindPitchTarget();
    this._bindModCvTarget();
    this._bindOctaveTarget();
  }

  setFreq(f) {
    this.freq = f;
    if (this.type !== "noise") {
      this.node.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01);
    }
  }

  dispose() {
    try { this.octaveOffset.stop(); } catch {}
    try { this.octaveOffset.disconnect(); } catch {}
    try { this.node.stop(); } catch {}
    try { this.node.disconnect(); } catch {}
    try { this.passthrough.disconnect(); } catch {}
    try { this.tap.disconnect(); } catch {}
  }

  setParam(name, value) {
    if (name === "type") this.setType(value);
    else if (name === "freq") this.setFreq(value);
    else if (name === "octave") {
      this.octave = value;
      this.octaveOffset.offset.setTargetAtTime(value * 1200, this.ctx.currentTime, 0.005);
    }
  }

  _bindOctaveTarget() {
    try { this.octaveOffset.disconnect(); } catch {}
    if (this.type === "noise") return;
    this.octaveOffset.connect(this.node.detune);
  }

  _bindPitchTarget() {
    const prev = this._pitchPorts.in.pitch;
    if (prev) { try { prev.disconnect(); } catch {} }
    if (this.type === "noise") {
      const stub = this.ctx.createGain();
      this._registerPitchIn("pitch", stub);
      return;
    }
    const scaler = this.ctx.createGain();
    scaler.gain.value = 1200;
    scaler.connect(this.node.detune);
    this._registerPitchIn("pitch", scaler);
  }

  _bindModCvTarget() {
    const prev = this._cvPorts.in.mod?.scaler;
    if (prev) { try { prev.disconnect(); } catch {} }
    if (this.type === "noise") {
      const stub = this.ctx.createGain();
      this._cvPorts.in.mod = { scaler: stub, range: 4800, target: null };
      return;
    }
    this._makeCvInput("mod", 4800, this.node.detune);
    this._makeSwitchInput("type", ["sine", "sawtooth", "square", "triangle", "noise"], 1);
  }

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
