// Shared draw config + helpers for ALL visualisations (oscilloscopes,
// frequency-response curves, envelope shapes, meters). Every screen pulls
// from this so glow, colours, grid, and CRT persistence are uniform.
//
// CSS owns the static UI; this file owns the canvas palette — the Canvas 2D
// API needs literal strings (it can't read CSS custom properties), so the
// brand tokens are duplicated once, here, as the single source of truth for
// every draw* module. If you change a brand colour, update both this file
// and styles/global.css.

// ---- brand-aligned canvas palette ----
// AUDIO = smem Red (the live signal). CONTROL = Rouge brightened just enough
// to read against the Ink CRT backdrop (pure Rouge crushes on the dark fill).
export const VIZ = {
  AUDIO_COLOR:       "#E62528",
  CONTROL_COLOR:     "#D14248",
  MARKER_COLOR:      "#F4F1EA",   // Paper — for the live "phase dot" overlays
  TEXT_PAPER:        "#F4F1EA",
  TEXT_PAPER_SOFT:   "rgba(244,241,234,.60)",

  // Audio low-alpha derivatives — fills, hairline reference lines, labels.
  AUDIO_FILL:        "rgba(230,37,40,.12)",
  AUDIO_BAND:        "rgba(230,37,40,.05)",
  AUDIO_HAIRLINE:    "rgba(230,37,40,.40)",
  AUDIO_LABEL:       "rgba(230,37,40,.85)",

  // Control low-alpha derivatives — for envelope/LFO reference rules.
  CONTROL_FILL:      "rgba(209,66,72,.12)",
  CONTROL_HAIRLINE:  "rgba(209,66,72,.55)",
  CONTROL_LABEL:     "rgba(209,66,72,.85)",

  // Inert "no signal" tint for the scope flatline.
  SCOPE_FLAT_TINT:   "rgba(244,241,234,.18)",

  // glow defaults — applied to every signal stroke.
  LINE_WIDTH:        2,
  GLOW_BLUR:         9,

  // CRT chrome — quiet Paper hairlines on the Ink backdrop.
  GRID_AMBER:        "rgba(244,241,234,.07)",
  GRID_GREEN:        "rgba(244,241,234,.07)",
  PERSIST_AMBER:     "rgba(0,0,0,.30)",
  PERSIST_GREEN:     "rgba(0,0,0,.30)",

  // canvas typography — IBM Plex Mono for labels/readouts to mirror the CSS
  // mono tokens in the chrome. Falls back gracefully if Plex isn't loaded.
  FONT_LABEL:        "9px 'IBM Plex Mono', ui-monospace, Menlo, monospace",
  FONT_READOUT:      "600 12px 'IBM Plex Mono', ui-monospace, Menlo, monospace",
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
