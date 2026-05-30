import { useEffect, useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";
import { getEngine } from "../../audio/engineSingleton.js";
import { useModuleInstance } from "../ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

// Manual gate trigger module. A press-and-hold button: opens the gate while
// pressed, releases on lift. The gate is emitted from this module's instance
// `gate` port and fans out to whatever destinations the user (or canonical
// chain) wired up. Spacebar is bound only on the canonical instance to avoid
// fighting between multiple free-mode gate modules.
export function GatePanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.gate;
  const isCanonical = id === CANONICAL_IDS.gate;

  // Visual `held` for the button — per-source highlight in the store. Free
  // instances of the same type share the highlight slot ("gate"); refining
  // to per-instance is future work.
  const held         = useSynthStore((s) => s.gateSources.gate);
  const setGateHeld  = useSynthStore((s) => s.setGateHeld);
  const setEnvPhase  = useSynthStore((s) => s.setEnvPhase);
  const markEnvStart = useSynthStore((s) => s.markEnvStart);

  const spaceHeldRef = useRef(false);
  const idRef = useRef(id);
  idRef.current = id;

  function open() {
    getEngine().emitGate(idRef.current, "gate", idRef.current, true);
    setGateHeld("gate", true);
    setEnvPhase("ad");
    markEnvStart();
  }

  function close() {
    getEngine().emitGate(idRef.current, "gate", idRef.current, false);
    setGateHeld("gate", false);
    setEnvPhase("rel");
    markEnvStart();
  }

  // Spacebar fires every Gate instance — holding space triggers every wired
  // destination simultaneously. If you want exclusive control, only add one
  // Gate module.
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
