import { grid, flat } from "./gridHelpers.js";

// data: { analyser: AnalyserNode|null, buf: Uint8Array (allocated once by caller) }
export function drawScope(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);
  grid(ctx, w, h);

  const an = data?.analyser;
  if (!an) { flat(ctx, w, h, "#3a2f1c"); return; }

  const buf = data.buf;
  an.getByteTimeDomainData(buf);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffb454";
  ctx.shadowColor = "#ffb454";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  const step = buf.length / w;
  for (let i = 0; i < w; i++) {
    const v = buf[Math.floor(i * step)] / 128 - 1;
    const y = h / 2 - v * (h * 0.40);
    if (i) ctx.lineTo(i, y); else ctx.moveTo(i, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
