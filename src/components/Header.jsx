import { BRAND, LEGEND, RESTART, SETTINGS } from "../content/ui.js";
import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "../content/journeys/index.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Header() {
  const resetSession    = useSynthStore((s) => s.resetSession);
  const backToJourneys  = useSynthStore((s) => s.backToJourneys);
  const setSettingsOpen = useSynthStore((s) => s.setSettingsOpen);
  const freeMode        = useSynthStore((s) => s.ui.freeMode);
  const setFreeMode     = useSynthStore((s) => s.setFreeMode);
  const journeyId       = useSynthStore((s) => s.journeyId);

  function restart() {
    try { getEngine().stop(); } catch {}
    resetSession();
  }

  function leaveToJourneys() {
    try { getEngine().stop(); } catch {}
    backToJourneys();
  }

  // Subtitle reflects the current mode: journey title, "Free Build", or nothing.
  const journey  = journeyId ? journeyById(journeyId) : null;
  const subtitle = freeMode ? "/ Free Build" : journey ? `/ ${journey.title}` : "";

  return (
    <header>
      <div className="brand">
        <img className="logo" src={import.meta.env.BASE_URL + "logo.svg"} alt={BRAND.logoAlt} />
        <span className="divider" />
        <h1><b>{BRAND.title}</b> {subtitle}</h1>
      </div>
      <div className="legend">
        <span className="a"><i />{LEGEND.audio}</span>
        <span className="c"><i />{LEGEND.control}</span>
        <span className="g"><i />{LEGEND.gate}</span>
        <button
          className={"icon-btn" + (freeMode ? " on" : "")}
          onClick={() => setFreeMode(!freeMode)}
          title={freeMode ? "Exit free build mode" : "Add modules and patch freely"}
        >
          <span aria-hidden="true">⌥</span> Free Build{freeMode ? " ✓" : ""}
        </button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={SETTINGS.open}>
          <span aria-hidden="true">⚙</span> {SETTINGS.open}
        </button>
        <button className="icon-btn" onClick={restart} title={RESTART}>
          <span aria-hidden="true">↺</span> {RESTART}
        </button>
        <button className="icon-btn" onClick={leaveToJourneys} title="Back to journeys">
          <span aria-hidden="true">←</span> Journeys
        </button>
      </div>
    </header>
  );
}
