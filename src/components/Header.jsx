import { useEffect, useRef, useState } from "react";
import { BRAND, LEGEND, RESTART, SETTINGS } from "../content/ui.js";
import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "../content/journeys/index.js";
import { usePuzzleAvailable } from "../content/puzzleHooks.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Header() {
  const resetSession    = useSynthStore((s) => s.resetSession);
  const backToJourneys  = useSynthStore((s) => s.backToJourneys);
  const setSettingsOpen = useSynthStore((s) => s.setSettingsOpen);
  const setPatchesOpen  = useSynthStore((s) => s.setPatchesOpen);
  const journeyId       = useSynthStore((s) => s.journeyId);
  const fullModular     = useSynthStore((s) => s.fullModular);
  const setFullModular  = useSynthStore((s) => s.setFullModular);
  const puzzleAvailable = usePuzzleAvailable();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Click outside / Escape closes the mobile dropdown.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function run(fn) {
    return () => { setMenuOpen(false); fn(); };
  }
  function restart() {
    try { getEngine().stop(); } catch {}
    resetSession();
  }
  function leaveToJourneys() {
    try { getEngine().stop(); } catch {}
    backToJourneys();
  }

  const journey  = journeyId ? journeyById(journeyId) : null;
  const subtitle = journey ? `/ ${journey.title}` : "/ Free Build";

  // Buttons are rendered once and reused inside the legend (desktop) and the
  // burger dropdown (mobile). CSS controls which group is visible.
  const actions = (
    <>
      {puzzleAvailable && (
        <button
          className="icon-btn btn-ghost"
          onClick={run(() => setFullModular(!fullModular))}
          title={fullModular
            ? "Back to the guided puzzle view"
            : "Switch to the full modular view — wires, every control, add your own modules"}
        >
          <span aria-hidden="true">{fullModular ? "⧉" : "⊞"}</span>
          {fullModular ? "Puzzle view" : "Modular view"}
        </button>
      )}
      <button className="icon-btn btn-ghost" onClick={run(() => setPatchesOpen(true))} title="Save / load patches">
        <span aria-hidden="true">⎙</span> Patches
      </button>
      <button className="icon-btn btn-ghost" onClick={run(() => setSettingsOpen(true))} title={SETTINGS.open}>
        <span aria-hidden="true">⚙</span> {SETTINGS.open}
      </button>
      <button className="icon-btn btn-ghost" onClick={run(restart)} title={RESTART}>
        <span aria-hidden="true">↺</span> {RESTART}
      </button>
      <button className="icon-btn btn-ghost" onClick={run(leaveToJourneys)} title="Back to journeys">
        <span aria-hidden="true">←</span> Journeys
      </button>
    </>
  );

  const legendSwatches = (
    <>
      <span className="a"><i />{LEGEND.audio}</span>
      <span className="c"><i />{LEGEND.control}</span>
      <span className="g"><i />{LEGEND.gate}</span>
    </>
  );

  return (
    <header>
      <div className="brand">
        <img className="logo" src={import.meta.env.BASE_URL + "logo.svg"} alt={BRAND.logoAlt} />
        <span className="divider" />
        <h1><b>{BRAND.title}</b> {subtitle}</h1>
      </div>
      <div className="legend">
        {legendSwatches}
        {actions}
      </div>
      <div className="header-mobile" ref={menuRef}>
        <button
          className={"burger" + (menuOpen ? " open" : "")}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
        {menuOpen && (
          <div className="burger-menu" role="menu">
            <div className="burger-legend">{legendSwatches}</div>
            <div className="burger-actions">{actions}</div>
          </div>
        )}
      </div>
    </header>
  );
}
