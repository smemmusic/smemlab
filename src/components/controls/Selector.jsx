// Waveform / option selector. Options: [{ value, label, wf? }].
// When `wf` is set, a mini SVG waveform preview renders above the label.

const WF = {
  sine:     "M0 7 Q6.5 -1 13 7 T26 7",
  sawtooth: "M0 12 L13 2 L13 12 L26 2",
  square:   "M0 12 L0 2 L13 2 L13 12 L26 12 L26 2",
  triangle: "M0 12 L6.5 2 L19.5 12 L26 2",
  noise:    "M0 7 L3 3 L5 11 L8 5 L10 12 L13 4 L15 9 L18 2 L20 11 L23 5 L26 8"
};

export function Selector({ options, value, onChange }) {
  return (
    <div className="selector">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.wf && (
            <svg className="wf" viewBox="0 0 26 14">
              <path d={WF[o.wf]} />
            </svg>
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
