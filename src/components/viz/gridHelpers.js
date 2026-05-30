// Shared draw config + helpers for ALL visualisations (oscilloscopes,
// frequency-response curves, envelope shapes, meters). Every screen pulls
// from this so glow, colours, grid, and CRT persistence are uniform.

// ---- single source of truth for visualiser config ----
export const VIZ = {
  // signal colours: audio = amber, control = cyan. Used everywhere a line is drawn.
  AUDIO_COLOR:   "#ffb454",
  CONTROL_COLOR: "#4fd6ff",

  // glow defaults — applied to every signal stroke.
  LINE_WIDTH:    2,
  GLOW_BLUR:     9,

  // grid tint by screen kind.
  GRID_AMBER:    "rgba(150,130,90,.10)",
  GRID_GREEN:    "rgba(120,150,130,.10)",

  // CRT persistence base by screen kind — translucent fill drawn each frame
  // for phosphor afterglow. Matches the .screen / .screen.amber CSS backdrops.
  PERSIST_AMBER: "rgba(18,12,5,.30)",
  PERSIST_GREEN: "rgba(7,17,11,.30)"
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
