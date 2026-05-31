import { AudioModule } from "../../audio/AudioModule.js";
import { dbToLin } from "../../audio/constants.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";

const KNOB_MIN_DB = -48;
const KNOB_MAX_DB = 12;
// Bipolar CV [-1, +1] maps linearly to a dB delta in [-CV_MAX_DB, +CV_MAX_DB]
// which is then summed with the knob. cv = 0 → 0 dB → no contribution, so an
// unwired CV input has no effect on the audio.
const CV_MAX_DB   = 48;
const SOFTCLIP_N  = 2048;

// Single audio amplifier stage with a tanh soft-clip on the output:
//
//   input ── gain ── softClip ── output
//
// The CV input is treated as a bipolar dB delta: cv = 0 → 0 dB (no effect),
// cv = +1 → +CV_MAX_DB, cv = -1 → -CV_MAX_DB. Polled at frame rate, summed
// in plain JS with the knob value, dbToLin → gain.gain via setTargetAtTime.
// No audio-rate math on the control path — just an AudioParam set.
//
// The output WaveShaper applies tanh so high gain values taper toward ±1
// smoothly rather than hard-clipping. When the *summed* signal (knob + CV)
// falls at or below KNOB_MIN_DB the linear gain snaps to exactly 0 — absolute
// silence — regardless of which side pushed it there. Positive CV can still
// lift a knob at -48 dB back above the threshold.
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
    this._cvDb = 0;                     // unwired CV → 0 dB contribution → no effect

    this.gain = ctx.createGain();
    this.gain.gain.value = this._totalLin();

    this.softClip = ctx.createWaveShaper();
    this.softClip.curve = _buildSoftClipCurve();

    this.gain.connect(this.softClip);

    this._registerAudioIn("input",   this.gain);
    this._registerAudioOut("output", this.softClip);
    // CV input: scaler + analyser tap only; no audio-graph connection. The
    // value is read in JS by getCvLevel and summed with the knob.
    this._makeCvInput("level", 1, null, { tap: true });

    this._pollRaf = 0;
    this._startPolling();
  }

  _totalLin() {
    const totalDb = this.level + this._cvDb;
    if (totalDb <= KNOB_MIN_DB) return 0;
    return dbToLin(totalDb);
  }

  // CV's dB contribution to the gain (already scaled by CV_MAX_DB). The panel
  // uses this for the meter so it doesn't need to mirror CV_MAX_DB itself.
  getCvDb() { return this._cvDb; }

  _applyGain() {
    const totalLin = this._totalLin();
    this.gain.gain.setTargetAtTime(totalLin, this.ctx.currentTime, 0.005);
  }

  setLevel(db) {
    this.level = db;
    this._applyGain();
  }

  setParam(name, value) {
    if (name === "level") this.setLevel(value);
  }

  _startPolling() {
    const tick = () => {
      this._pollCv();
      this._pollRaf = requestAnimationFrame(tick);
    };
    this._pollRaf = requestAnimationFrame(tick);
  }

  _pollCv() {
    const cv = this.getCvLevel("level");
    const cvDb = cv * CV_MAX_DB;
    if (cvDb !== this._cvDb) {
      this._cvDb = cvDb;
      this._applyGain();
    }
  }

  dispose() {
    if (this._pollRaf) cancelAnimationFrame(this._pollRaf);
    this._pollRaf = 0;
    try { this.gain.disconnect(); } catch {}
    try { this.softClip.disconnect(); } catch {}
    super.dispose();
  }
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
