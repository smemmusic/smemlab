// Module faceplate glyphs — block-diagram silkscreens drawn in the m-head.

export const GLYPHS = {
  oscillator: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <circle cx="9" cy="11" r="7.5" />
      <path d="M4 11 Q6.5 6 9 11 T14 11" />
      <line x1="16.5" y1="11" x2="32" y2="11" />
    </svg>
  ),
  filter: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M2 6 H17 Q23 6 25 17 L32 19" />
    </svg>
  ),
  amp: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M9 4 L26 11 L9 18 Z" />
    </svg>
  ),
  env: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M2 19 L9 4 L15 11 L23 11 L32 19" />
    </svg>
  ),
  lfo: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M2 11 Q8 3 14 11 T26 11" />
      <path d="M28 11 L32 11 M30 9 L32 11 L30 13" />
    </svg>
  ),
  keyboard: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <rect x="2" y="6" width="30" height="14" />
      <line x1="8" y1="6" x2="8" y2="20" />
      <line x1="14" y1="6" x2="14" y2="20" />
      <line x1="20" y1="6" x2="20" y2="20" />
      <line x1="26" y1="6" x2="26" y2="20" />
      <rect x="5.5" y="6" width="3.5" height="8" />
      <rect x="11.5" y="6" width="3.5" height="8" />
      <rect x="22.5" y="6" width="3.5" height="8" />
    </svg>
  ),
  gate: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      {/* A simple square-pulse glyph: "high while held". */}
      <path d="M2 18 H10 V6 H22 V18 H32" />
    </svg>
  ),
  output: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M5 8 H11 L18 3 V19 L11 14 H5 Z" />
      <path d="M23 7 Q27 11 23 15" />
    </svg>
  ),
  inverter: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      {/* Mirrored sine pair across a horizontal axis — the input wave above,
          the inverted output below. */}
      <line x1="2" y1="11" x2="32" y2="11" strokeDasharray="2 2" opacity="0.5" />
      <path d="M2 11 Q8 5 14 11 T26 11" />
      <path d="M2 11 Q8 17 14 11 T26 11" opacity="0.6" />
      <path d="M28 11 L32 11 M30 9 L32 11 L30 13" />
    </svg>
  ),
  cvmixer: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      {/* Four input lines converging to a master summing point with output. */}
      <line x1="2"  y1="4"  x2="16" y2="11" />
      <line x1="2"  y1="8"  x2="16" y2="11" />
      <line x1="2"  y1="14" x2="16" y2="11" />
      <line x1="2"  y1="18" x2="16" y2="11" />
      <circle cx="16" cy="11" r="2.5" />
      <line x1="18.5" y1="11" x2="32" y2="11" />
    </svg>
  )
};
