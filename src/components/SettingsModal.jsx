import { useEffect } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { SETTINGS, SCOPE_TRIGGER } from "../content/ui.js";
import { Toggle } from "./controls/Toggle.jsx";
import { Knob } from "./controls/Knob.jsx";

// Lever-up = rising edge. options[0] = "up" state per the Toggle convention.
const TRIGGER_OPTIONS = [
  { value: "rising",  ...SCOPE_TRIGGER.rising },
  { value: "falling", ...SCOPE_TRIGGER.falling }
];

export function SettingsModal() {
  const open    = useSynthStore((s) => s.settingsOpen);
  const setOpen = useSynthStore((s) => s.setSettingsOpen);

  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const setEdge      = useSynthStore((s) => s.setScopeEdge);
  const setThreshold = useSynthStore((s) => s.setScopeThreshold);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Modal is always mounted so the fade transition can run. `hide` opacity-fades.
  return (
    <div
      className={"modal-backdrop" + (open ? "" : " hide")}
      onClick={() => setOpen(false)}
      aria-hidden={!open}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={SETTINGS.title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{SETTINGS.title}</h2>
          <button className="modal-close" onClick={() => setOpen(false)} aria-label={SETTINGS.close}>✕</button>
        </header>

        <section className="setting-group">
          <div className="setting-title">{SETTINGS.scope.sectionTitle}</div>
          <p className="setting-desc">{SETTINGS.scope.description}</p>
          <div className="ctrl-grid">
            <div className="setting-cell">
              <div className="setting-label">{SETTINGS.scope.edgeLabel}</div>
              <Toggle options={TRIGGER_OPTIONS} value={edge} onChange={setEdge} />
            </div>
            <div className="setting-cell">
              <Knob
                label={SETTINGS.scope.thresholdLabel}
                value={threshold}
                min={-0.95}
                max={0.95}
                step={0.05}
                unit="%"
                onChange={setThreshold}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
