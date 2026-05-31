// ± button pair with a labelled value between. Caller owns storage,
// formatting, and any keyboard shortcuts; the component renders the buttons
// and label, clamping clicks to [min, max]. Used for any single-step integer:
// octave shifts, mode numbers, voice counts, etc.

export function Stepper({
  label,
  value,
  min,
  max,
  format = (v) => `${v}`,
  onChange,
  downAriaLabel,
  upAriaLabel,
}) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div className="stepper">
      <button
        className="stepper-btn"
        onClick={() => onChange(clamp(value - 1))}
        aria-label={downAriaLabel ?? `${label} down`}
      >−</button>
      <span className="stepper-label">{label} <b>{format(value)}</b></span>
      <button
        className="stepper-btn"
        onClick={() => onChange(clamp(value + 1))}
        aria-label={upAriaLabel ?? `${label} up`}
      >+</button>
    </div>
  );
}
