import { CV_LABEL } from "../../content/ui.js";

export function VCable({ label = CV_LABEL }) {
  return (
    <div className="cable-v">
      <svg viewBox="0 0 44 44" preserveAspectRatio="none">
        <path d="M22 44 L22 8" fill="none" stroke="var(--control)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        <path className="flowy" d="M22 44 L22 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="22" cy="42" r="3.5" fill="var(--control)" />
        <path d="M22 4 L17 13 L27 13 Z" fill="var(--control)" />
      </svg>
      <span className="cv-label">{label}</span>
    </div>
  );
}
