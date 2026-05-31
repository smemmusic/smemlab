// Four wavy input lines converging on a summing point, then out — same shape
// as the CV mixer glyph but with sinusoidal feeds to read as "audio".
export const AudioMixerGlyph = (
  <svg className="m-glyph" viewBox="0 0 34 22">
    <path d="M2 4  Q5 2  8 4  T14 4" />
    <path d="M2 8  Q5 6  8 8  T14 8" />
    <path d="M2 14 Q5 12 8 14 T14 14" />
    <path d="M2 18 Q5 16 8 18 T14 18" />
    <line x1="14" y1="4"  x2="20" y2="11" />
    <line x1="14" y1="8"  x2="20" y2="11" />
    <line x1="14" y1="14" x2="20" y2="11" />
    <line x1="14" y1="18" x2="20" y2="11" />
    <circle cx="20" cy="11" r="2.5" />
    <line x1="22.5" y1="11" x2="32" y2="11" />
  </svg>
);
