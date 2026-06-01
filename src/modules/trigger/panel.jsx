import { useEffect, useRef, useState } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { usePuzzleShow } from "../../content/puzzleHooks.js";

// Manual gate trigger. Press-and-hold button: opens the gate while pressed,
// releases on lift. The gate emits from this instance's `gate` port and fans
// out via engine.emitGate to whatever destinations are wired.
//
// Each instance has its own `shortcut` (KeyboardEvent.code, default "Space") so
// two Triggers can play independent voices from different keys.

const DEFAULT_PARAMS = { shortcut: "Space" };

// KeyboardEvent.code → display label. Anything not listed falls through to a
// stripped form of the code itself.
function displayShortcut(code) {
  if (!code) return "—";
  if (code === "Space") return "Space";
  if (code.startsWith("Key"))   return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const arrows = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  if (arrows[code]) return arrows[code];
  if (code === "Enter")     return "Enter";
  if (code === "Escape")    return "Esc";
  if (code === "Tab")       return "Tab";
  if (code === "Backspace") return "⌫";
  return code;
}

export function TriggerPanel() {
  const { instanceId: id } = useModuleInstance();
  const show = usePuzzleShow(id);

  const params = useSynthStore((s) => s.modules.find((m) => m.id === id)?.params) || DEFAULT_PARAMS;
  const shortcut = params.shortcut ?? "Space";
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  const [held, setHeld] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const keyHeldRef = useRef(false);
  const idRef = useRef(id);
  idRef.current = id;
  const shortcutRef = useRef(shortcut);
  shortcutRef.current = shortcut;
  const capturingRef = useRef(capturing);
  capturingRef.current = capturing;

  function open() {
    getEngine().emitGate(idRef.current, "gate", idRef.current, true);
    setHeld(true);
  }
  function close() {
    getEngine().emitGate(idRef.current, "gate", idRef.current, false);
    setHeld(false);
  }

  useEffect(() => {
    function typingTarget(t) {
      const tag = t?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || t?.isContentEditable;
    }
    function onDown(e) {
      if (capturingRef.current) {
        // Swallow the keystroke and use it as the new binding. Escape cancels.
        e.preventDefault();
        if (e.code === "Escape") { setCapturing(false); return; }
        setModuleParam(idRef.current, "shortcut", e.code);
        setCapturing(false);
        return;
      }
      if (e.code !== shortcutRef.current) return;
      if (e.repeat || typingTarget(e.target) || keyHeldRef.current) return;
      e.preventDefault();
      keyHeldRef.current = true;
      open();
    }
    function onUp(e) {
      if (e.code !== shortcutRef.current) return;
      if (!keyHeldRef.current) return;
      e.preventDefault();
      keyHeldRef.current = false;
      close();
    }
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (keyHeldRef.current) {
        keyHeldRef.current = false;
        close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the binding changes while a key is held, release the gate so it doesn't
  // stick — keyup for the previous code will no longer match.
  useEffect(() => {
    if (keyHeldRef.current) {
      keyHeldRef.current = false;
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcut]);

  function press(e)   { e.preventDefault(); open(); }
  function release(e) { e.preventDefault(); close(); }

  const shortcutLabel = displayShortcut(shortcut);

  return (
    <div className="trigger-mod-body">
      {show("button") && (
        <button
          type="button"
          className={"trigger-button" + (held ? " held" : "")}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={(e) => { if (held) release(e); }}
          title={`Hold to open the gate (also: ${shortcutLabel})`}
        >
          <span className="trigger-lamp" />
          <span className="trigger-label">Hold</span>
          <span className="trigger-sub">{shortcutLabel.toLowerCase()} ▸ trigger</span>
        </button>
      )}
      {show("shortcut") && (
        <div className="trigger-shortcut">
          <span className="trigger-shortcut-label">Shortcut</span>
          <button
            type="button"
            className={"trigger-shortcut-btn" + (capturing ? " capturing" : "")}
            onClick={() => setCapturing((c) => !c)}
            title={capturing ? "Press a key… (Esc to cancel)" : "Click then press a key to rebind"}
          >
            {capturing ? "Press a key…" : shortcutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
