export function Segment({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt.value}
          data-v={opt.value}
          className={opt.value === value ? "on" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
