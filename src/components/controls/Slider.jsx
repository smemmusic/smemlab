import { useMemo } from "react";

function format(value, unit) {
  switch (unit) {
    case "Hz": return Math.round(value) + " Hz";
    case "s":  return value.toFixed(value < 0.1 ? 3 : 2) + "s";
    case "Q":  return value.toFixed(1);
    case "%":  return Math.round(value) + "%";
    case "dB": return value <= -48 ? "−∞ dB" : (value > 0 ? "+" : "") + value.toFixed(1) + " dB";
    default:   return value.toFixed(2);
  }
}

// Ported verbatim from legacy: log-scale slider maps [0..1000] ↔ [min..max] geometrically.
export function Slider({ label, value, min, max, step = 0.01, unit, log = false, onChange }) {
  const inputValue = useMemo(() => {
    if (log) return Math.round((Math.log(value / min) / Math.log(max / min)) * 1000);
    return value;
  }, [value, min, max, log]);

  function handleInput(e) {
    const raw = +e.target.value;
    const v = log ? min * Math.pow(max / min, raw / 1000) : raw;
    onChange(v);
  }

  return (
    <div className="ctrl">
      <div className="row">
        <span>{label}</span>
        <span className="val">{format(value, unit)}</span>
      </div>
      <input
        type="range"
        min={log ? 0 : min}
        max={log ? 1000 : max}
        step={log ? 1 : step}
        value={inputValue}
        onChange={handleInput}
      />
    </div>
  );
}
