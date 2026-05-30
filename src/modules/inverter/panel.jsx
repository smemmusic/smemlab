// Inverter has no controls — just shows the inversion symbol so the user can
// see at a glance what the module does. Ports (rendered by ModulePorts in
// free mode) provide the actual functionality: wire any CV into "in", read
// the negated signal at "out".

export function InverterPanel() {
  return (
    <div className="inverter-body">
      <div className="inverter-symbol" aria-hidden="true">
        <span className="inv-label">in</span>
        <span className="inv-op">× &minus;1</span>
        <span className="inv-label">out</span>
      </div>
      <div className="inverter-hint">flips sign of any CV</div>
    </div>
  );
}
