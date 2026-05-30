import { BRAND, LEGEND, RESTART, SETTINGS } from "../content/ui.js";
import { useSynthStore } from "../store/useSynthStore.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Header() {
  const resetSession    = useSynthStore((s) => s.resetSession);
  const setSettingsOpen = useSynthStore((s) => s.setSettingsOpen);

  function restart() {
    try { getEngine().stop(); } catch {}
    resetSession();
  }

  return (
    <header>
      <div className="brand">
        <img className="logo" src="/logo.svg" alt={BRAND.logoAlt} />
        <span className="divider" />
        <h1><b>{BRAND.title}</b> {BRAND.subtitle}</h1>
      </div>
      <div className="legend">
        <span className="a"><i />{LEGEND.audio}</span>
        <span className="c"><i />{LEGEND.control}</span>
        <span className="g"><i />{LEGEND.gate}</span>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={SETTINGS.open}>
          <span aria-hidden="true">⚙</span> {SETTINGS.open}
        </button>
        <button className="icon-btn" onClick={restart} title={RESTART}>
          <span aria-hidden="true">↺</span> {RESTART}
        </button>
      </div>
    </header>
  );
}
