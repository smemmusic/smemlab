import { useEffect, useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";

// Manual gate trigger module. A press-and-hold button that mirrors the
// Transport's Gate button: opens the gate while pressed, releases on lift.
// Same store state (`held`, `envPhase`, `envStart`) drives both UIs and the
// ADSR animation, so the env reacts identically regardless of which gate
// source the user touches. The spacebar is wired to the same handlers
// while this module is mounted, so users can play hands-free.
export function GatePanel() {
  // Visual `held` for the button — use this source's flag specifically so the
  // button only lights when *this* module triggers, not when something else
  // (the keyboard) opens the gate.
  const held         = useSynthStore((s) => s.gateSources.gate);
  const envOn        = useSynthStore((s) => s.blocks.env);
  const setGateHeld  = useSynthStore((s) => s.setGateHeld);
  const setEnvPhase  = useSynthStore((s) => s.setEnvPhase);
  const markEnvStart = useSynthStore((s) => s.markEnvStart);

  // Refs so the keyboard listeners always read the latest values without
  // having to re-subscribe each render.
  const envOnRef = useRef(envOn);
  envOnRef.current = envOn;
  const spaceHeldRef = useRef(false);

  function open() {
    if (!envOnRef.current) return;
    getEngine().noteOn();
    setGateHeld("gate", true);
    setEnvPhase("ad");
    markEnvStart();
  }

  function close() {
    if (!envOnRef.current) return;
    getEngine().noteOff();
    setGateHeld("gate", false);
    setEnvPhase("rel");
    markEnvStart();
  }

  // Spacebar = gate. Skips repeats and form-field targets so it doesn't
  // hijack typing in the settings modal or preset name inputs.
  useEffect(() => {
    function typingTarget(t) {
      const tag = t?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || t?.isContentEditable;
    }
    function onDown(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat) return;
      if (typingTarget(e.target)) return;
      if (spaceHeldRef.current) return;
      e.preventDefault();                 // stop space from scrolling the page
      spaceHeldRef.current = true;
      open();
    }
    function onUp(e) {
      if (e.code !== "Space" && e.key !== " ") return;
      if (!spaceHeldRef.current) return;
      e.preventDefault();
      spaceHeldRef.current = false;
      close();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      // If the module unmounts while spacebar is down, release the gate so
      // the env doesn't stick in "ad" forever.
      if (spaceHeldRef.current) {
        spaceHeldRef.current = false;
        if (envOnRef.current) {
          getEngine().noteOff();
          setGateHeld("gate", false);
          setEnvPhase("rel");
          markEnvStart();
        }
      }
    };
  }, []);

  // Pointer handlers — same open/close.
  function press(e) { e.preventDefault(); open(); }
  function release(e) { e.preventDefault(); close(); }

  return (
    <div className="gate-mod-body">
      <button
        type="button"
        className={"gate-trigger" + (held ? " held" : "")}
        disabled={!envOn}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={(e) => { if (held) release(e); }}
        title="Hold to open the gate (also: spacebar)"
      >
        <span className="gate-trigger-lamp" />
        <span className="gate-trigger-label">Hold</span>
        <span className="gate-trigger-sub">space ▸ trigger</span>
      </button>
    </div>
  );
}
