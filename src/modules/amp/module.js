import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

const KNOB_MIN_DB = -48;
const KNOB_MAX_DB = 12;
// Bipolar CV [-1, +1] maps to a dB delta in [-CV_MAX_DB, +CV_MAX_DB], summed
// with the knob. cv = 0 → 0 dB → no contribution, so an unwired CV input has no
// effect on the audio.
const CV_MAX_DB   = 48;
const SOFTCLIP_N  = 2048;
// Odd length so a curve sample lands exactly on cv = 0 (the WaveShaper maps
// input 0 → index (N-1)/2). That makes "knob at -48 dB, envelope idle (cv 0)"
// resolve to exactly 0 — true silence — instead of interpolating across the
// floor discontinuity to a faint -54 dB.
const CV_CURVE_N  = 1025;

// Single audio amplifier stage with a tanh soft-clip on the output:
//
//   input ── vca ── softClip ── output
//
// The CV input is a bipolar dB delta (cv = 0 → 0 dB; +1 → +CV_MAX_DB; -1 →
// -CV_MAX_DB) summed with the knob. The whole gain law runs on the audio thread:
// the summed CV signal feeds a WaveShaper whose curve maps it to the linear gain
// `clampedDbToLin(level + cv*CV_MAX_DB)` (the exact dB sum, with `total ≤
// KNOB_MIN_DB → 0` for true silence), and that drives the VCA gain AudioParam.
// No rAF poll on the audio path — an envelope's ramp reaches the gain
// sample-accurately. The analyser tap is kept only for the panel meter.
export class AmplifierModule extends AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [
    { name: "input",  dir: PORT_DIR.IN,  type: PORT_TYPE.AUDIO },
    { name: "output", dir: PORT_DIR.OUT, type: PORT_TYPE.AUDIO },
  ];
  static CONTROLS = [
    { name: "level", kind: CONTROL_KIND.KNOB, range: [KNOB_MIN_DB, KNOB_MAX_DB],
      curve: CONTROL_CURVE.LINEAR, cvPolarity: CV_POLARITY.BIPOLAR },
  ];

  constructor(ctx, { level }) {
    super(ctx);
    this.level = level;
    this._cvDb = 0;                     // meter readout only

    // VCA: intrinsic gain 0; the CV WaveShaper supplies the full gain signal.
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;

    this.softClip = ctx.createWaveShaper();
    this.softClip.curve = _buildSoftClipCurve();
    this.vca.connect(this.softClip);

    // CV path: summed CV → cvShaper(level-dependent dB curve) → vca.gain.
    this.cvShaper = ctx.createWaveShaper();
    this.cvShaper.curve = _buildCvCurve(this.level);
    this.cvShaper.connect(this.vca.gain);

    this._registerAudioIn("input",   this.vca);
    this._registerAudioOut("output", this.softClip);
    // The level CV scaler (gain 1) sums all CV sources and feeds the cvShaper.
    // A tap is kept purely for the panel meter (getCvDb), not the audio path.
    this._makeCvInput("level", 1, this.cvShaper, { tap: true });

    // Poll only to refresh the meter value; the gain itself is audio-rate.
    this._pollOnFrame = true;
  }

  // CV's dB contribution (for the panel meter only).
  getCvDb() { return this._cvDb; }

  setLevel(db) {
    this.level = db;
    this.cvShaper.curve = _buildCvCurve(db);
  }

  setParam(name, value) {
    if (name === "level") this.setLevel(value);
  }

  _onPollFrame(onChange, isConnected) {
    super._onPollFrame(onChange, isConnected);
    // Meter only — read the post-mix CV contribution; no effect on audio.
    this._cvDb = isConnected(this.id, "level") ? this.getCvLevel("level") * CV_MAX_DB : 0;
  }

  dispose() {
    try { this.vca.disconnect(); } catch {}
    try { this.cvShaper.disconnect(); } catch {}
    try { this.softClip.disconnect(); } catch {}
    super.dispose();
  }
}

// gain curve over summed CV x ∈ [-1, +1]: clampedDbToLin(level + x*CV_MAX_DB).
// total ≤ KNOB_MIN_DB snaps to exactly 0 (absolute silence) regardless of which
// side pushed it there; positive CV can lift a knob at -48 dB back above it.
function _buildCvCurve(levelDb) {
  const curve = new Float32Array(CV_CURVE_N);
  for (let i = 0; i < CV_CURVE_N; i++) {
    const x = (i / (CV_CURVE_N - 1)) * 2 - 1;
    const totalDb = levelDb + x * CV_MAX_DB;
    curve[i] = totalDb <= KNOB_MIN_DB ? 0 : dbToLin(totalDb);
  }
  return curve;
}

// tanh curve over [-1, +1]: near-unity at small magnitudes, smooth saturation
// toward ±tanh(1) ≈ ±0.76 as |x| approaches 1. Inputs beyond ±1 clamp to the
// curve endpoints.
function _buildSoftClipCurve() {
  const curve = new Float32Array(SOFTCLIP_N);
  for (let i = 0; i < SOFTCLIP_N; i++) {
    const x = (i / (SOFTCLIP_N - 1)) * 2 - 1;
    curve[i] = Math.tanh(x);
  }
  return curve;
}
