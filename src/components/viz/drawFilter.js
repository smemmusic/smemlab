import { grid } from "./gridHelpers.js";

// data: { filterNode: BiquadFilterNode|null, cutoff: number, q: number }
// Falls back to an OfflineAudioContext biquad when the engine hasn't started yet.
const N = 160, MIN_F = 20, MAX_F = 20000;
const _freqs = new Float32Array(N);
const _mag   = new Float32Array(N);
const _ph    = new Float32Array(N);
for (let i = 0; i < N; i++) _freqs[i] = MIN_F * Math.pow(MAX_F / MIN_F, i / (N - 1));

let _offlineBq = null;
function getOfflineBq() {
  if (_offlineBq) return _offlineBq;
  const oc = new OfflineAudioContext(1, 1, 44100);
  const bq = oc.createBiquadFilter();
  bq.type = "lowpass";
  _offlineBq = bq;
  return bq;
}

export function drawFilter(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);
  grid(ctx, w, h);

  let bq = data?.filterNode;
  if (!bq) {
    bq = getOfflineBq();
    bq.frequency.value = data?.cutoff ?? 1200;
    bq.Q.value = data?.q ?? 1;
  }
  bq.getFrequencyResponse(_freqs, _mag, _ph);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffb454";
  ctx.shadowColor = "#ffb454";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const db = 20 * Math.log10(Math.max(_mag[i], 1e-4));
    const y = h / 2 - (db / 40) * (h / 2);
    const px = (i / (N - 1)) * w;
    if (i) ctx.lineTo(px, y); else ctx.moveTo(px, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cutoff marker
  const cutoff = data?.cutoff ?? bq.frequency.value;
  const cx = (Math.log(cutoff / MIN_F) / Math.log(MAX_F / MIN_F)) * w;
  ctx.strokeStyle = "rgba(255,180,84,.4)";
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();
  ctx.setLineDash([]);
}
