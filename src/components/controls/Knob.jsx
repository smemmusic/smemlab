// Drag-up-to-increase knob. Shift = fine. -135° → +135° sweep over [min..max].
// Logarithmic range supported via the `log` prop.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function format(v, unit) {
  switch (unit) {
    case "Hz": return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + " kHz" : Math.round(v) + " Hz";
    case "s":  return v.toFixed(v < 0.1 ? 3 : 2) + "s";
    case "Q":  return v.toFixed(1);
    case "dB": return v <= -48 ? "−∞ dB" : (v > 0 ? "+" : "") + v.toFixed(1) + " dB";
    case "%":  return Math.round(v * 100) + "%";
    default:   return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
}

export function Knob({ label, value, min, max, step, unit, log, onChange }) {
  const norm = log ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min);
  const angle = -135 + clamp(norm, 0, 1) * 270;

  function down(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startNorm = clamp(norm, 0, 1);
    const fine = e.shiftKey ? 0.25 : 1;
    function move(ev) {
      const dy = startY - ev.clientY;
      const nn = clamp(startNorm + (dy / 200) * fine, 0, 1);
      let v = log ? min * Math.pow(max / min, nn) : min + nn * (max - min);
      if (step) v = Math.round(v / step) * step;
      onChange(clamp(v, min, max));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="knob">
      <div className="dial" onPointerDown={down} title="Drag up / down · Shift = fine">
        <span className="ticks" />
        <span className="mark" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }} />
      </div>
      <div className="lab">{label}</div>
      <div className="val">{format(value, unit)}</div>
    </div>
  );
}
