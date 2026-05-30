import { persist, flat, beginGlow, endGlow, VIZ } from "./gridHelpers.js";

// Time-domain trigger: find the first sample where the signal crosses the
// configured threshold in the requested direction. The byte buffer is 0..255
// with 128 = 0V, so threshold maps as: byte = 128 + threshold * 128.
// Threshold ∈ [-1, +1] where 0 = zero crossing.
//
// Search is bounded so there are always `windowLen` samples after the trigger
// point to draw. Returns 0 if no crossing is found.
function findTrigger(buf, edge, thresholdByte, windowLen) {
  const searchEnd = buf.length - windowLen;
  if (edge === "falling") {
    for (let i = 1; i < searchEnd; i++) {
      if (buf[i - 1] >= thresholdByte && buf[i] < thresholdByte) return i;
    }
  } else {
    for (let i = 1; i < searchEnd; i++) {
      if (buf[i - 1] < thresholdByte && buf[i] >= thresholdByte) return i;
    }
  }
  return 0;
}

// Vertical span the trace fills on the canvas (as a fraction of height).
// Same value for every scope so they all look equally "full".
const VERT_FILL = 0.40;

// data: { analyser, buf, color?, edge?: "rising"|"falling", threshold?: number (-1..+1) }
export function drawScope(ctx, w, h, data) {
  const color = data?.color || VIZ.AUDIO_COLOR;
  persist(ctx, w, h, "amber");

  const an = data?.analyser;
  if (!an) {
    ctx.globalAlpha = 0.5;
    flat(ctx, w, h, "#3a2f1c");
    ctx.globalAlpha = 1;
    return;
  }

  const buf = data.buf;
  an.getByteTimeDomainData(buf);

  // Auto-gain: find peak deviation from the centerline and scale the trace so
  // it always fills the same vertical span. Without this, a quieter signal
  // draws a narrower curve and its glow halo looks visibly weaker than a
  // louder/saturated one — which is why the raw VCO and post-amp Output
  // appeared to glow differently even though the rendering pipeline is the
  // same. Min-floor on peakDev prevents over-amplifying silence into noise.
  let peakDev = 1;
  for (let i = 0; i < buf.length; i++) {
    const dev = Math.abs(buf[i] - 128);
    if (dev > peakDev) peakDev = dev;
  }
  const verticalScale = (h * VERT_FILL) / Math.max(peakDev, 16);   // 16 ≈ -18 dBFS noise floor

  const threshold = data?.threshold ?? 0;
  const thresholdByte = 128 + threshold * 128;
  const windowLen = Math.floor(buf.length / 2);
  const triggerIdx = findTrigger(buf, data?.edge || "rising", thresholdByte, windowLen);

  beginGlow(ctx, color);
  ctx.beginPath();
  const step = windowLen / w;
  for (let i = 0; i < w; i++) {
    const dev = buf[triggerIdx + Math.floor(i * step)] - 128;
    const y = h / 2 - dev * verticalScale;
    if (i) ctx.lineTo(i, y); else ctx.moveTo(i, y);
  }
  ctx.stroke();
  endGlow(ctx);
}
