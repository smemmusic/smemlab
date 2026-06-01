// Shared draw config + helpers for ALL visualisations (oscilloscopes,
// frequency-response curves, envelope shapes, meters). Every screen pulls
// from this so glow, colours, grid, and CRT persistence are uniform.

// ---- single source of truth for visualiser config ----
// Brand palette: Audio = Red (the live signal), Control = a brighter Rouge
// readable on the Ink CRT (pure Rouge would crush against the dark backdrop).
export const VIZ = {
  AUDIO_COLOR:   "#E62528",   // smem Red
  CONTROL_COLOR: "#D14248",   // Rouge brightened for CRT contrast

  // glow defaults — applied to every signal stroke.
  LINE_WIDTH:    2,
  GLOW_BLUR:     9,

  // grid tint — quiet Paper hairlines on the Ink CRT.
  GRID_AMBER:    "rgba(244,241,234,.07)",
  GRID_GREEN:    "rgba(244,241,234,.07)",

  // CRT persistence base — translucent Ink wash for phosphor afterglow.
  PERSIST_AMBER: "rgba(0,0,0,.30)",
  PERSIST_GREEN: "rgba(0,0,0,.30)"
};

export function grid(ctx, w, h, tint) {
  ctx.strokeStyle = tint || VIZ.GRID_GREEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); }
  for (let i = 1; i < 6; i++) { ctx.moveTo(w * i / 6, 0); ctx.lineTo(w * i / 6, h); }
  ctx.stroke();
}

// CRT persistence pass. `kind` is "amber" | "green" — picks both the base fill
// tint and the matching grid colour so screens stay visually consistent.
export function persist(ctx, w, h, kind = "green") {
  const base = kind === "amber" ? VIZ.PERSIST_AMBER : VIZ.PERSIST_GREEN;
  const tint = kind === "amber" ? VIZ.GRID_AMBER    : VIZ.GRID_GREEN;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  grid(ctx, w, h, tint);
}

// Glow primitive: set stroke + shadow in one shot. Pair with endGlow() so the
// shadow doesn't leak into subsequent draws (text labels, dashed markers, etc.).
export function beginGlow(ctx, color, { width = VIZ.LINE_WIDTH, blur = VIZ.GLOW_BLUR } = {}) {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
export function endGlow(ctx) {
  ctx.shadowBlur = 0;
}

export function flat(ctx, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = VIZ.LINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}
