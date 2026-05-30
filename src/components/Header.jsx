import { BRAND, LEGEND } from "../content/ui.js";

export function Header() {
  return (
    <header>
      <div className="brand">
        <span className="mark">{BRAND.mark}</span>
        <h1>{BRAND.title} <span>{BRAND.subtitle}</span></h1>
      </div>
      <div className="legend">
        <span className="a"><i />{LEGEND.audio}</span>
        <span className="c"><i />{LEGEND.control}</span>
      </div>
    </header>
  );
}
