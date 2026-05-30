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
  output: (
    <svg className="m-glyph" viewBox="0 0 34 22">
      <path d="M5 8 H11 L18 3 V19 L11 14 H5 Z" />
      <path d="M23 7 Q27 11 23 15" />
    </svg>
  )
};
