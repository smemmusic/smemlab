import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

// 0..11 — the twelve semitone roots, used both as the switch's CV-quantise
// table and as the values written back to the param when a CV drives `root`.
const ROOT_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Pitch quantizer. Reads an incoming CV (0..1) and snaps it to the nearest
// note of a chosen scale, emitting a V/oct pitch (1 V = 1 octave = 12
// semitones). The 0..1 input is mapped across `range` semitones, rounded to a
// scale degree, then converted to volts on the `out` pitch port.
//
// The read-quantise-write step runs in the engine's per-frame poll loop. That
// is plenty for a stepped sequencer, where the input only changes when the
// multiplexer hands over to the next step — no need for audio-rate work.
const SCALES = {
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
};

// Snap an absolute semitone value to the nearest degree of `scale`, searching
// the degree in this octave and the octave above so notes near the top of the
// octave can round up to the next root.
function snapToScale(semi, scaleName) {
  const degrees = SCALES[scaleName] || SCALES.chromatic;
  const oct = Math.floor(semi / 12);
  const within = semi - oct * 12;
  let best = oct * 12 + degrees[0];
  let bestDist = Infinity;
  for (const o of [oct, oct + 1]) {
    for (const d of degrees) {
      const note = o * 12 + d;
      const dist = Math.abs(note - (oct * 12 + within));
      if (dist < bestDist) { bestDist = dist; best = note; }
    }
  }
  return best;
}

export class QuantizerModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "in",  dir: PORT_DIR.IN,  type: PORT_TYPE.CV },
    { name: "out", dir: PORT_DIR.OUT, type: PORT_TYPE.PITCH },
  ];
  static CONTROLS = [
    { name: "range", kind: CONTROL_KIND.KNOB,   range: [12, 36], curve: CONTROL_CURVE.LINEAR, cvInput: false },
    // Root is patchable: a CV input quantised to one of the 12 semitones. A
    // unipolar 0..1 voltage sweeps the whole octave of roots.
    { name: "root",  kind: CONTROL_KIND.SWITCH, values: ROOT_VALUES, cvRange: 1, cvPolarity: CV_POLARITY.UNIPOLAR,
      description: "scale root (0V → C, 1V → B)" },
    { name: "scale", kind: CONTROL_KIND.SWITCH, values: ["chromatic", "major", "minor", "pentatonic"], cvInput: false },
  ];

  constructor(ctx, { range = 24, scale = "major", root = 0 } = {}) {
    super(ctx);
    this.range = range;
    this.scale = scale;
    this.root = root;              // scale root, 0..11 semitones above the base note
    this.note = 0;                 // last quantised semitone, read by the panel
    this._lastSemi = null;

    // Tapped CV input — the poll loop reads the post-mix voltage here. Range 1
    // so the tap reports the raw incoming 0..1 voltage. Not vizOnly: the tap is
    // load-bearing (quantisation depends on it) and must survive visuals-off.
    const scaler = this._makeCvInput("in", 1, null, { tap: true });
    // The input only feeds an analyser, which is a graph dead-end — Web Audio
    // won't reliably render a chain with no path to the destination, so the tap
    // would read stale data. Route it through a muted sink to keep it live
    // (same trick the clock uses for its worklet).
    this._inSink = ctx.createGain();
    this._inSink.gain.value = 0;
    scaler.connect(this._inSink).connect(ctx.destination);

    // Root CV input: the engine's poll loop quantises the tapped voltage to a
    // semitone index and writes it back to the `root` param (so the panel's
    // stepper tracks the incoming voltage). Route its scaler through the same
    // muted sink so the tapped chain renders.
    this._makeSwitchInput("root", ROOT_VALUES, 1);
    this._cvPorts.in.root.scaler.connect(this._inSink);

    // Output pitch as a steady V/oct voltage on a constant source.
    this.outNode = ctx.createConstantSource();
    this.outNode.offset.value = 0;
    this.outNode.start();
    this._registerPitchOut("out", this.outNode);

    this._pollOnFrame = true;
  }

  // Read the freshest tap sample rather than getCvLevel()'s 256-sample mean:
  // the input is a near-DC step that changes when the multiplexer hands over,
  // and the mean smears that step across a frame (and can briefly land on an
  // intermediate note). The last element of the time-domain buffer is the most
  // recent sample, so step detection is crisp.
  _readInput() {
    const entry = this._cvPorts.in.in;
    const an = entry?.analyser;
    if (!an) return 0;
    if (!entry._buf) entry._buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(entry._buf);
    return entry._buf[entry._buf.length - 1];
  }

  _onPollFrame(onChange, isConnected) {
    super._onPollFrame(onChange, isConnected);   // no switch CV inputs, but stay polite
    if (!isConnected(this.id, "in")) return;
    const cv = Math.max(0, Math.min(1, this._readInput()));
    // Shift into the scale's frame (so the root becomes degree 0), snap, then
    // shift back — transposing the whole scale up by `root` semitones.
    const semi = snapToScale(Math.round(cv * this.range) - this.root, this.scale) + this.root;
    if (semi === this._lastSemi) return;
    this._lastSemi = semi;
    this.note = semi;
    this.outNode.offset.setTargetAtTime(semi / 12, this.ctx.currentTime, 0.006);
  }

  setParam(name, value) {
    if (name === "range")      { this.range = value; this._lastSemi = null; }
    else if (name === "root")  { this.root  = value; this._lastSemi = null; }
    else if (name === "scale") { this.scale = value; this._lastSemi = null; }
  }

  dispose() {
    try { this.outNode.stop(); } catch {}
    try { this.outNode.disconnect(); } catch {}
    try { this._inSink.disconnect(); } catch {}
    super.dispose();
  }
}
