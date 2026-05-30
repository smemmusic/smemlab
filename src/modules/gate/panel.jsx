import { useEffect, useRef, useState } from "react";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

// Manual gate trigger. Press-and-hold button: opens the gate while pressed,
// releases on lift. The gate emits from this instance's `gate` port and fans
// out via engine.emitGate to whatever destinations are wired. Spacebar fires
// every Gate instance simultaneously — only add one if you want exclusive control.
export function GatePanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.gate;
  const isCanonical = id === CANONICAL_IDS.gate;

  // Local visual "held" state. Per-instance; no store coordination needed
  // since each Gate module routes its own gate.
  const [held, setHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const idRef = useRef(id);
  idRef.current = id;

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
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || typingTarget(e.target) || spaceHeldRef.current) return;
      e.preventDefault();
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
      if (spaceHeldRef.current) {
        spaceHeldRef.current = false;
        close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function press(e)   { e.preventDefault(); open(); }
  function release(e) { e.preventDefault(); close(); }

  return (
    <div className="gate-mod-body">
      <button
        type="button"
        className={"gate-trigger" + (held ? " held" : "")}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={(e) => { if (held) release(e); }}
        title={isCanonical ? "Hold to open the gate (also: spacebar)" : "Hold to open this gate"}
      >
        <span className="gate-trigger-lamp" />
        <span className="gate-trigger-label">Hold</span>
        <span className="gate-trigger-sub">{isCanonical ? "space ▸ trigger" : "trigger"}</span>
      </button>
    </div>
  );
}
