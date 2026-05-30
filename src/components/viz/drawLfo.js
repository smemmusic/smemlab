import { persist, beginGlow, endGlow, VIZ } from "./gridHelpers.js";
import { lfoSample } from "./lfoShape.js";

// LFOs are too slow for an FFT-based analyser to capture cleanly, so we
// synthesise the trace. To match the oscilloscope's behaviour, the trigger
// (edge + threshold) locks the trace on the X-axis. Unlike the previous
// approach the time window is fixed in seconds — so increasing the rate
// packs more cycles into the same span (same way raising the VCO pitch
// packs more cycles into the audio scope's fixed sample window).
const TIME_WINDOW_SEC = 1.5;

// Numerical trigger search across one cycle. Returns the phase p∈[0,1) where
// the LFO crosses `threshold` in the requested direction; 0 if no crossing.
function findTriggerPhase(shape, edge, threshold, resolution = 1024) {
  let prev = lfoSample(shape, 0);
  for (let i = 1; i <= resolution; i++) {
    const p = i / resolution;
    const cur = lfoSample(shape, p);
    if (edge === "falling") {
      if (prev >= threshold && cur < threshold) return (i - 1) / resolution;
    } else {
      if (prev < threshold && cur >= threshold) return (i - 1) / resolution;
    }
    prev = cur;
  }
  return 0;
}

// data: { lfo: { shape, rate, depth (0..1) }, edge?, threshold? }
export function drawLfo(ctx, w, h, data) {
  persist(ctx, w, h, "green");
  if (!data) return;
  const { lfo } = data;
  const pad = 6;
  // Visual amplitude scales linearly with depth (0..1). depth = 0 → amp = 0
  // → the trace collapses to a flat line at midline (matches "no modulation").
  const amp = (h * 0.34) * Math.min(1, Math.max(0, lfo.depth));
  const mid = h / 2;

  // Cycles visible = rate × window. Same shape as the audio scope: changing
  // the source's frequency changes how many cycles fit on screen.
  const cycles = lfo.rate * TIME_WINDOW_SEC;

  const edge      = data.edge      || "rising";
  const threshold = data.threshold ?? 0;
  const phase = findTriggerPhase(lfo.shape, edge, threshold);

  beginGlow(ctx, VIZ.CONTROL_COLOR, { width: 2.2 });
  ctx.beginPath();
  const span = w - pad * 2;
  for (let i = 0; i <= span; i++) {
    const t = (i / span) * cycles;
    const p = ((t + phase) % 1 + 1) % 1;
    const y = mid - lfoSample(lfo.shape, p) * amp;
    if (i) ctx.lineTo(pad + i, y); else ctx.moveTo(pad + i, y);
  }
  ctx.stroke();
  endGlow(ctx);

  // Trigger-level marker at the left edge — shows where the trace locks.
  const yMark = mid - threshold * amp;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(pad, yMark, 3.2, 0, 7);
  ctx.fill();
}
