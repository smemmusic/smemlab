import { grid } from "./gridHelpers.js";
import { linToDb } from "../../audio/constants.js";

// data: {
//   ampDb: number, blocks: {amp,env}, playing: bool,
//   getVcaValue: () => number, hist: number[] (mutable buffer owned by caller)
// }
const M_TOP = 12, M_FLR = -48;

export function drawMeter(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);
  grid(ctx, w, h);
  if (!data) return;

  const { ampDb, blocks, playing, getVcaValue, hist } = data;
  const top = 14, bot = h - 4;
  const dbY = (db) => bot - (bot - top) * ((Math.min(Math.max(db, M_FLR), M_TOP) - M_FLR) / (M_TOP - M_FLR));

  const ampPart = blocks.amp ? ampDb : 0;
  const envDb   = playing ? linToDb(getVcaValue()) : (blocks.env ? -80 : 0);
  const totalDb = playing ? Math.max(M_FLR, ampPart + Math.max(envDb, M_FLR)) : M_FLR;

  hist.push(totalDb);
  if (hist.length > 180) hist.shift();
  const n = hist.length;
  const X = (i) => (i / 179) * w;

  // amplification zone above 0 dB
  ctx.fillStyle = "rgba(255,180,84,.05)";
  ctx.fillRect(0, top, w, dbY(0) - top);

  // 0 dB unity line
  ctx.strokeStyle = "rgba(255,180,84,.2)";
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(0, dbY(0));
  ctx.lineTo(w, dbY(0));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,180,84,.4)";
  ctx.font = "9px 'Chakra Petch',sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("0 dB", 4, dbY(0) - 3);

  // gain offset line
  ctx.strokeStyle = "rgba(79,214,255,.55)";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(0, dbY(ampPart));
  ctx.lineTo(w, dbY(ampPart));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(79,214,255,.8)";
  ctx.textAlign = "right";
  ctx.fillText("gain offset", w - 8, dbY(ampPart) - 3);

  // total level over time — filled area
  ctx.beginPath();
  ctx.moveTo(0, bot);
  for (let i = 0; i < n; i++) ctx.lineTo(X(i), dbY(hist[i]));
  ctx.lineTo(X(n - 1), bot);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,180,84,.12)";
  ctx.fill();

  // total level over time — line
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i) ctx.lineTo(X(i), dbY(hist[i]));
    else   ctx.moveTo(X(i), dbY(hist[i]));
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffb454";
  ctx.shadowColor = "#ffb454";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // readout
  ctx.font = "600 12px 'Chakra Petch',sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffb454";
  ctx.fillText((totalDb <= M_FLR ? "−∞" : (totalDb > 0 ? "+" : "") + totalDb.toFixed(1)) + " dB", w - 8, h - 9);

  if (blocks.env) {
    ctx.textAlign = "left";
    ctx.font = "9px 'Chakra Petch',sans-serif";
    ctx.fillStyle = "rgba(236,231,218,.6)";
    const a = (ampPart > 0 ? "+" : "") + ampPart.toFixed(0);
    const e = envDb <= M_FLR ? "−∞" : (envDb > 0 ? "+" : "") + envDb.toFixed(0);
    ctx.fillText("gain " + a + "  +  env " + e, 6, h - 9);
  }
}
