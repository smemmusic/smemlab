import { persist, beginGlow, endGlow, VIZ } from "./gridHelpers.js";
import { lfoSample, currentPhase } from "./lfoShape.js";
import { CUTOFF_MOD_RANGE_HZ } from "../../audio/constants.js";

// Web Audio's BiquadFilterNode.getFrequencyResponse() only reads the AudioParam's
// INTRINSIC value — it ignores any modulation signals connected to it. So to
// show the cutoff sweeping with the LFO, we have to compute the effective
// cutoff ourselves and run the response on an offline biquad each frame.
//
// data: { cutoff, q, mode, lfo?: {rate, depth, shape}, playing: bool }
const N = 160, MIN_F = 20, MAX_F = 20000;
const _freqs = new Float32Array(N);
const _mag   = new Float32Array(N);
const _ph    = new Float32Array(N);
for (let i = 0; i < N; i++) _freqs[i] = MIN_F * Math.pow(MAX_F / MIN_F, i / (N - 1));

let _offlineBq = null;
function getOfflineBq() {
  if (_offlineBq) return _offlineBq;
  const oc = new OfflineAudioContext(1, 1, 44100);
  _offlineBq = oc.createBiquadFilter();
  return _offlineBq;
}

export function drawFilter(ctx, w, h, data) {
  persist(ctx, w, h, "amber");

  const knobCutoff = data?.cutoff ?? 1200;
  // If the LFO is patched and audio is playing, add its current value × depth
  // to the knob cutoff so the displayed curve matches the audible sweep.
  let modulation = 0;
  if (data?.lfo && data?.playing) {
    // Mirror the engine's signal chain:
    //   lfo.osc (±1) × lfo.depth (0..1) × CUTOFF_MOD_RANGE_HZ → added to cutoff AudioParam.
    const p = currentPhase(data.lfo.rate);
    modulation = lfoSample(data.lfo.shape, p) * data.lfo.depth * CUTOFF_MOD_RANGE_HZ;
  }
  const effectiveCutoff = Math.max(20, knobCutoff + modulation);

  const bq = getOfflineBq();
  bq.type = data?.mode || "lowpass";
  bq.frequency.value = effectiveCutoff;
  bq.Q.value = data?.q ?? 1;
  bq.getFrequencyResponse(_freqs, _mag, _ph);

  beginGlow(ctx, VIZ.AUDIO_COLOR);
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const db = 20 * Math.log10(Math.max(_mag[i], 1e-4));
    const y = h / 2 - (db / 40) * (h / 2);
    const px = (i / (N - 1)) * w;
    if (i) ctx.lineTo(px, y); else ctx.moveTo(px, y);
  }
  ctx.stroke();
  endGlow(ctx);

  // Red hairline = the static cutoff knob position. Audio colour, lives where
  // the user set it — even when the LFO is sweeping the actual cutoff around it.
  const cxKnob = (Math.log(Math.max(20, knobCutoff) / MIN_F) / Math.log(MAX_F / MIN_F)) * w;
  ctx.strokeStyle = VIZ.AUDIO_HAIRLINE;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(cxKnob, 0);
  ctx.lineTo(cxKnob, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rouge hairline = the LFO-modulated effective cutoff. Control colour,
  // moves with the modulation. Only shown when the LFO is actually patched.
  if (data?.lfo && data?.playing) {
    const cxMod = (Math.log(effectiveCutoff / MIN_F) / Math.log(MAX_F / MIN_F)) * w;
    ctx.strokeStyle = VIZ.CONTROL_HAIRLINE;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(cxMod, 0);
    ctx.lineTo(cxMod, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
