import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

const KEY_TO_SEMI = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5,
  t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12
};
const WHITE_NOTES = [
  { semi: 0,  pcName: "C", kbd: "A" },
  { semi: 2,  pcName: "D", kbd: "S" },
  { semi: 4,  pcName: "E", kbd: "D" },
  { semi: 5,  pcName: "F", kbd: "F" },
  { semi: 7,  pcName: "G", kbd: "G" },
  { semi: 9,  pcName: "A", kbd: "H" },
  { semi: 11, pcName: "B", kbd: "J" },
  { semi: 12, pcName: "C", kbd: "K" }
];
const BLACK_NOTES = [
  { semi: 1,  pcName: "C#", kbd: "W", leftPct: 12.5 - 4 },
  { semi: 3,  pcName: "D#", kbd: "E", leftPct: 25.0 - 4 },
  { semi: 6,  pcName: "F#", kbd: "T", leftPct: 50.0 - 4 },
  { semi: 8,  pcName: "G#", kbd: "Y", leftPct: 62.5 - 4 },
  { semi: 10, pcName: "A#", kbd: "U", leftPct: 75.0 - 4 }
];

const OCTAVE_MIN = 0;
const OCTAVE_MAX = 6;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function KeyboardPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.keyboard;
  const isCanonical = id === CANONICAL_IDS.keyboard;

  const octave       = useSynthStore((s) => s.keyboard.octave);
  const setOctave    = useSynthStore((s) => s.setKeyboardOctave);
  const setGateHeld  = useSynthStore((s) => s.setGateHeld);
  const setEnvPhase  = useSynthStore((s) => s.setEnvPhase);
  const markEnvStart = useSynthStore((s) => s.markEnvStart);

  // Mono-legato note stack (most recent wins). Ref because audio decisions
  // don't need a re-render — only the visual highlight does.
  const heldRef = useRef([]);
  const [pressed, setPressed] = useState(new Set());
  const octaveRef = useRef(octave);
  octaveRef.current = octave;
  const idRef = useRef(id);
  idRef.current = id;

  function pressMidi(midi) {
    if (heldRef.current.includes(midi)) return;
    heldRef.current = [...heldRef.current, midi];
    setPressed(new Set(heldRef.current));
    const engine = getEngine();
    // V/oct pitch update via the KeyboardModule's pitchOut. The canonical
    // chain wires kb.pitch → osc.pitch, so the connected oscillator's detune
    // tracks the played note. For free-mode instances the user wires it up.
    engine.playMidi(idRef.current, midi);
    // Gate emit: fans out via the connections table to env.trigger (chapter
    // mode) or whatever the user wired up (free mode).
    engine.emitGate(idRef.current, "gate", idRef.current, true);
    setGateHeld("keyboard", true);
    setEnvPhase("ad");
    markEnvStart();
  }

  function releaseMidi(midi) {
    const idx = heldRef.current.indexOf(midi);
    if (idx === -1) return;
    const next = heldRef.current.slice();
    next.splice(idx, 1);
    heldRef.current = next;
    setPressed(new Set(next));
    const engine = getEngine();
    if (next.length > 0) {
      // Latch back to the most recent surviving note (mono legato). Gate stays open.
      engine.playMidi(idRef.current, next[next.length - 1]);
    } else {
      engine.emitGate(idRef.current, "gate", idRef.current, false);
      setGateHeld("keyboard", false);
      setEnvPhase("rel");
      markEnvStart();
    }
  }

  // Computer keyboard: register listeners once per Keyboard instance. If the
  // user has multiple Keyboard modules mounted, every instance responds to
  // the same key press — each one emits pitch + gate to its own wired
  // destinations. Add exclusive-focus logic later if shared listening proves
  // surprising.
  useEffect(() => {
    function isTypingTarget(t) {
      const tag = t?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || t?.isContentEditable;
    }
    function onDown(e) {
      if (e.repeat) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z") { setOctave(clamp(octaveRef.current - 1, OCTAVE_MIN, OCTAVE_MAX)); return; }
      if (k === "x") { setOctave(clamp(octaveRef.current + 1, OCTAVE_MIN, OCTAVE_MAX)); return; }
      const offset = KEY_TO_SEMI[k];
      if (offset === undefined) return;
      e.preventDefault();
      pressMidi(12 * (octaveRef.current + 1) + offset);
    }
    function onUp(e) {
      const k = e.key.toLowerCase();
      const offset = KEY_TO_SEMI[k];
      if (offset === undefined) return;
      releaseMidi(12 * (octaveRef.current + 1) + offset);
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (heldRef.current.length > 0) {
        getEngine().emitGate(idRef.current, "gate", idRef.current, false);
      }
      heldRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOctave]);

  function mDown(midi)  { return (e) => { e.preventDefault(); pressMidi(midi); }; }
  function mUp(midi)    { return ()  => { releaseMidi(midi); }; }
  function mLeave(midi) { return (e) => { if (e.buttons === 1) releaseMidi(midi); }; }

  const baseMidi = 12 * (octave + 1);
  const octaveLabel = `C${octave}`;

  return (
    <>
      <div className="kb">
        <div className="kb-whites">
          {WHITE_NOTES.map((n) => {
            const midi = baseMidi + n.semi;
            const on = pressed.has(midi);
            return (
              <div
                key={n.semi}
                className={"kb-key white" + (on ? " on" : "")}
                onPointerDown={mDown(midi)}
                onPointerUp={mUp(midi)}
                onPointerLeave={mLeave(midi)}
              >
                <span className="kb-label">{n.kbd}</span>
              </div>
            );
          })}
        </div>
        <div className="kb-blacks">
          {BLACK_NOTES.map((n) => {
            const midi = baseMidi + n.semi;
            const on = pressed.has(midi);
            return (
              <div
                key={n.semi}
                className={"kb-key black" + (on ? " on" : "")}
                style={{ left: `${n.leftPct}%` }}
                onPointerDown={mDown(midi)}
                onPointerUp={mUp(midi)}
                onPointerLeave={mLeave(midi)}
              >
                <span className="kb-label">{n.kbd}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="kb-octave">
        <button
          className="kb-octave-btn"
          onClick={() => setOctave(clamp(octave - 1, OCTAVE_MIN, OCTAVE_MAX))}
          aria-label="Octave down (Z)"
        >−</button>
        <span className="kb-octave-label">Octave <b>{octaveLabel}</b></span>
        <button
          className="kb-octave-btn"
          onClick={() => setOctave(clamp(octave + 1, OCTAVE_MIN, OCTAVE_MAX))}
          aria-label="Octave up (X)"
        >+</button>
      </div>
    </>
  );
}
