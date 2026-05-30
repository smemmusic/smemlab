// Bat-handle toggle switch. Two-state.
// options = [{ value, label, short }, { value, label, short }] — options[0] = lever-up state.
// Click anywhere on the switch body to flip.

export function Toggle({ options, value, onChange }) {
  const up = options[0].value === value;

  function flip() {
    onChange(options[up ? 1 : 0].value);
  }

  return (
    <div className="toggle">
      <div
        className={"sw" + (up ? " on" : "")}
        onClick={flip}
        role="switch"
        aria-checked={up}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } }}
      >
        <span className="plate" />
        <span className="legend-on">{options[0].short}</span>
        <span className="nut" />
        <span className="lever" />
        <span className="legend-off">{options[1].short}</span>
      </div>
      <div className="opts">
        {options.map((o) => (
          <span key={o.value} className={o.value === value ? "on" : ""}>{o.label}</span>
        ))}
      </div>
    </div>
  );
}
