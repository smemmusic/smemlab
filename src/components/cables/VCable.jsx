import { CV_LABEL } from "../../content/ui.js";

export function VCable() {
  return (
    <div className="cable v">
      <svg viewBox="0 0 46 46" preserveAspectRatio="none">
        <path d="M23 46 L23 8" fill="none" stroke="var(--control)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        <path className="flowy" d="M23 46 L23 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="23" cy="44" r="3.5" fill="var(--control)" />
        <path d="M23 4 L18 13 L28 13 Z" fill="var(--control)" />
      </svg>
      <span className="cv-label">{CV_LABEL}</span>
    </div>
  );
}
