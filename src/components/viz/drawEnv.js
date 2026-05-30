import { grid } from "./gridHelpers.js";
import { DB_FLOOR } from "../../audio/constants.js";

// data: { env: {a,d,sustainDb,r}, envPhase: "idle"|"ad"|"rel", envStart: ms, playing: bool }
export function drawEnv(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);
  grid(ctx, w, h);
  if (!data) return;

  const { env: e, envPhase, envStart, playing } = data;
  const pad = 8, top = 14, bot = h - 10;
  const total = e.a + e.d + 0.45 + e.r;
  const sx = (w - pad * 2) / total;

  const dbY = (db) => bot - (bot - top) * ((Math.max(db, DB_FLOOR) - DB_FLOOR) / (0 - DB_FLOOR));
  const xA = pad + e.a * sx;
  const xD = xA + e.d * sx;
  const xS = xD + 0.45 * sx;
  const xR = xS + e.r * sx;
  const yPk = dbY(0);
  const yS  = dbY(e.sustainDb);
  const y0  = dbY(DB_FLOOR);

  // 0 dB ceiling marker
  ctx.strokeStyle = "rgba(79,214,255,.25)";
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

  // ADSR shape
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#4fd6ff";
  ctx.shadowColor = "#4fd6ff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(pad, y0);
  ctx.lineTo(xA, yPk);
  ctx.lineTo(xD, yS);
  ctx.lineTo(xS, yS);
  ctx.lineTo(xR, y0);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (envPhase !== "idle" && playing) {
    const el = (performance.now() - envStart) / 1000;
    let px = null;
    if (envPhase === "ad")  { px = Math.min(pad + Math.min(el, (xS - pad) / sx) * sx, xS); }
    else if (envPhase === "rel") { px = xS + Math.min(el, e.r) * sx; }
    if (px !== null) {
      const yy =
        px < xA ? y0 - ((px - pad) / (xA - pad)) * (y0 - yPk) :
        px < xD ? yPk + ((px - xA) / (xD - xA)) * (yS - yPk) :
        px < xS ? yS :
                  yS + ((px - xS) / (xR - xS)) * (y0 - yS);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(Math.min(px, xR), yy, 3.5, 0, 7);
      ctx.fill();
    }
  }
}
