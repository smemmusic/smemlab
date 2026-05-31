import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { STEPS, TRACKS } from "./module.js";

const TRACK_LABELS = ["1", "2", "3", "4"];

function emptyPattern() {
  return Array.from({ length: TRACKS }, () => Array(STEPS).fill(false));
}

const DEFAULT_PARAMS = { pattern: emptyPattern() };

export function DrumSeqPanel() {
  const { instanceId: id } = useModuleInstance();
  const params  = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const setModuleParam = useSynthStore((s) => s.setModuleParam);
  const pattern = params.pattern || DEFAULT_PARAMS.pattern;

  // Mirror the module's live stepIdx for the playhead column highlight.
  // setState short-circuits when the value is unchanged so we don't re-render
  // 60 fps just because rAF is ticking.
  const [step, setStep] = useState(-1);
  const rafRef = useRef(0);
  useEffect(() => {
    function tick() {
      const m = getEngine().getGraph().getModule(id);
      const s = m?.stepIdx ?? -1;
      setStep((prev) => (prev === s ? prev : s));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [id]);

  function toggle(track, stepIdx) {
    const next = pattern.map((row, t) =>
      t === track ? row.map((v, s) => (s === stepIdx ? !v : v)) : row
    );
    setModuleParam(id, "pattern", next);
  }

  function clearTrack(track) {
    const next = pattern.map((row, t) =>
      t === track ? Array(STEPS).fill(false) : row
    );
    setModuleParam(id, "pattern", next);
  }

  return (
    <div className="drumseq-body">
      {pattern.map((row, t) => (
        <div className="drumseq-track" key={t}>
          <button
            type="button"
            className="drumseq-track-label"
            onClick={() => clearTrack(t)}
            title={`Track ${TRACK_LABELS[t]} · click to clear`}
          >
            {TRACK_LABELS[t]}
          </button>
          <div className="drumseq-cells">
            {[0, 1, 2, 3].map((g) => (
              <div className="drumseq-group" key={g}>
                {row.slice(g * 4, g * 4 + 4).map((on, i) => {
                  const s = g * 4 + i;
                  const cls = [
                    "drumseq-cell",
                    on && "on",
                    s === step && "playing",
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      key={s}
                      type="button"
                      className={cls}
                      onClick={() => toggle(t, s)}
                      aria-label={`Track ${TRACK_LABELS[t]} step ${s + 1}`}
                      aria-pressed={on}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
