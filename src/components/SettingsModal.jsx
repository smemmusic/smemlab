import { useEffect, useState } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { SETTINGS, SCOPE_TRIGGER } from "../content/ui.js";
import { Toggle } from "./controls/Toggle.jsx";
import { Knob } from "./controls/Knob.jsx";
import { getEngine } from "../audio/engineSingleton.js";

function formatMs(seconds) {
  if (typeof seconds !== "number" || !isFinite(seconds)) return SETTINGS.audio.inactive;
  return `${(seconds * 1000).toFixed(1)} ms`;
}

function formatHz(hz) {
  if (typeof hz !== "number" || !isFinite(hz)) return SETTINGS.audio.inactive;
  return `${(hz / 1000).toFixed(1)} kHz`;
}

// Lever-up = rising edge. options[0] = "up" state per the Toggle convention.
const TRIGGER_OPTIONS = [
  { value: "rising",  ...SCOPE_TRIGGER.rising },
  { value: "falling", ...SCOPE_TRIGGER.falling }
];

const DISPLAYS_OPTIONS = [
  { value: true,  label: "On",  short: "ON"  },
  { value: false, label: "Off", short: "OFF" }
];

export function SettingsModal() {
  const open    = useSynthStore((s) => s.settingsOpen);
  const setOpen = useSynthStore((s) => s.setSettingsOpen);

  const edge      = useSynthStore((s) => s.scope.edge);
  const threshold = useSynthStore((s) => s.scope.threshold);
  const visualsEnabled = useSynthStore((s) => s.visualsEnabled);
  const setEdge      = useSynthStore((s) => s.setScopeEdge);
  const setThreshold = useSynthStore((s) => s.setScopeThreshold);
  const setVisualsEnabled = useSynthStore((s) => s.setVisualsEnabled);

  // AudioContext readout — re-sampled each time the modal opens (and via a
  // short interval while open, since outputLatency drifts with the OS buffer).
  const [audioInfo, setAudioInfo] = useState(null);
  useEffect(() => {
    if (!open) return;
    const refresh = () => setAudioInfo(getEngine().getAudioInfo());
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [open]);

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
          <button className="modal-close btn-ghost" onClick={() => setOpen(false)} aria-label={SETTINGS.close}>✕</button>
        </header>

        <section className="setting-group">
          <div className="setting-title">{SETTINGS.audio.sectionTitle}</div>
          <p className="setting-desc">{SETTINGS.audio.description}</p>
          <div className="ctrl-grid">
            <div className="setting-cell">
              <div className="setting-readout">{formatHz(audioInfo?.sampleRate)}</div>
              <div className="setting-label">{SETTINGS.audio.sampleRateLabel}</div>
            </div>
            <div className="setting-cell">
              <div className="setting-readout">{formatMs(audioInfo?.baseLatency)}</div>
              <div className="setting-label">{SETTINGS.audio.baseLatencyLabel}</div>
            </div>
            <div className="setting-cell">
              <div className="setting-readout">{formatMs(audioInfo?.outputLatency)}</div>
              <div className="setting-label">{SETTINGS.audio.outputLatencyLabel}</div>
            </div>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-title">{SETTINGS.displays.sectionTitle}</div>
          <p className="setting-desc">{SETTINGS.displays.description}</p>
          <div className="ctrl-grid">
            <div className="setting-cell">
              <div className="setting-label">{SETTINGS.displays.enabledLabel}</div>
              <Toggle
                options={DISPLAYS_OPTIONS}
                value={visualsEnabled}
                onChange={setVisualsEnabled}
              />
            </div>
          </div>
        </section>

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
