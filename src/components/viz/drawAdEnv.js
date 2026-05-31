import { persist, beginGlow, endGlow, VIZ } from "./gridHelpers.js";
import { DB_FLOOR } from "../../audio/constants.js";

// AD envelope visualiser. Two segments only — attack ramp up, decay ramp
// down — so the shape fills the canvas. (Reusing drawEnv would squeeze
// half the canvas into a synthetic sustain plateau that AD doesn't have.)
//
// data: { env: {a, d}, phase: "idle" | "ad", start: ms, playing: bool }
export function drawAdEnv(ctx, w, h, data) {
  persist(ctx, w, h, "green");
  if (!data) return;

  const { env: e, phase, start, playing } = data;
  const pad = 8, top = 14, bot = h - 10;
  const total = Math.max(e.a + e.d, 0.001);
  const sx = (w - pad * 2) / total;

  const dbY = (db) => bot - (bot - top) * ((Math.max(db, DB_FLOOR) - DB_FLOOR) / (0 - DB_FLOOR));
  const xA = pad + e.a * sx;
  const xD = xA + e.d * sx;
  const yPk = dbY(0);
  const y0  = dbY(DB_FLOOR);

  // 0 dB ceiling marker
  ctx.strokeStyle = "rgba(79,214,255,.22)";
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(0, yPk);
  ctx.lineTo(w, yPk);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(79,214,255,.5)";
  ctx.font = "9px 'Chakra Petch',sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("0 dB", 4, yPk - 3);

  // AD shape — control signal, cyan glow
  beginGlow(ctx, VIZ.CONTROL_COLOR);
  ctx.beginPath();
  ctx.moveTo(pad, y0);
  ctx.lineTo(xA, yPk);
  ctx.lineTo(xD, y0);
  ctx.stroke();
  endGlow(ctx);

  // Live phase dot — only during the cycle (after a+d seconds the dot
  // simply stops rendering; no need for the engine to flip to "idle").
  if (phase === "ad" && playing) {
    const el = (performance.now() - start) / 1000;
    if (el <= total) {
      const px = pad + el * sx;
      const yy = px < xA
        ? y0 - ((px - pad) / Math.max(xA - pad, 0.001)) * (y0 - yPk)
        : yPk + ((px - xA) / Math.max(xD - xA, 0.001)) * (y0 - yPk);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px, yy, 3.5, 0, 7);
      ctx.fill();
    }
  }
}
