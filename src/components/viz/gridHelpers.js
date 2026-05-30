// Shared draw helpers for visualisers.

export function grid(ctx, w, h) {
  ctx.strokeStyle = "#1c2029";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); }
  for (let i = 1; i < 6; i++) { ctx.moveTo(w * i / 6, 0); ctx.lineTo(w * i / 6, h); }
  ctx.stroke();
}

export function flat(ctx, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}
