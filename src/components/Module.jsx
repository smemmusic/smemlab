import { useRef } from "react";
import { MODULE_META, KIND_LABEL } from "../content/moduleMeta.js";
import { GLYPHS } from "../content/glyphs.jsx";
import { useSynthStore } from "../store/useSynthStore.js";
import { ModuleInstanceContext } from "./ModuleInstanceContext.js";
import { CANONICAL_IDS, CANONICAL_DEFAULT_POSITIONS } from "../store/graphBuilder.js";
import { ModulePorts } from "./ModulePorts.jsx";

const REMOVABLE_SLOTS = new Set(["filter", "amp", "env", "lfo", "keyboard", "gate"]);
const SLOT_TO_BLOCK = {
  filter: "filter", amp: "amp", env: "env", lfo: "lfo",
  keyboard: "keyboard", gate: "gate",
};

const SLOT_TO_CANONICAL = {
  oscillator: CANONICAL_IDS.osc,
  filter:     CANONICAL_IDS.filter,
  amp:        CANONICAL_IDS.amp,
  env:        CANONICAL_IDS.env,
  lfo:        CANONICAL_IDS.lfo,
  output:     CANONICAL_IDS.output,
  keyboard:   null,
  gate:       null,
};

// Selectors that identify interactive children — clicks on these should NOT
// trigger module focus (they have their own handlers, e.g. knob dragging,
// port clicks, button presses).
const INTERACTIVE_SELECTOR = "button, input, select, textarea, .knob, .toggle, .selector, .kb, .port, .screen, canvas, svg";

export function Module({ id, instanceId, children }) {
  const slotName = id;
  const meta = MODULE_META[slotName];
  const removeBlock = useSynthStore((s) => s.removeBlock);
  const removeModuleInstance = useSynthStore((s) => s.removeModuleInstance);
  const setModulePosition = useSynthStore((s) => s.setModulePosition);
  const freeMode = useSynthStore((s) => s.ui.freeMode);
  const focusModule = useSynthStore((s) => s.focusModule);
  const moduleRef = useRef(null);
  const position = useSynthStore((s) => {
    const idCandidate = instanceId || SLOT_TO_CANONICAL[slotName];
    return idCandidate ? s.modules.find((m) => m.id === idCandidate)?.position : null;
  });

  const resolvedInstanceId = instanceId || SLOT_TO_CANONICAL[slotName] || null;
  const isFreeInstance = resolvedInstanceId && !resolvedInstanceId.startsWith("_");
  const isOutput = resolvedInstanceId === CANONICAL_IDS.output;

  function handleRemove(e) {
    e.stopPropagation();
    if (freeMode) {
      if (resolvedInstanceId) removeModuleInstance(resolvedInstanceId);
      return;
    }
    if (isFreeInstance) {
      removeModuleInstance(resolvedInstanceId);
    } else if (REMOVABLE_SLOTS.has(slotName)) {
      removeBlock(SLOT_TO_BLOCK[slotName]);
    }
  }

  const showRemove = freeMode
    ? !isOutput
    : (isFreeInstance || REMOVABLE_SLOTS.has(slotName));

  const effectivePosition = position
    || CANONICAL_DEFAULT_POSITIONS[resolvedInstanceId]
    || (isFreeInstance ? { x: 0, y: 0 } : null);

  const isDraggable = freeMode && effectivePosition;
  // Tracks whether the pointer moved during a drag, so the trailing click
  // event after a drag doesn't also fire module focus.
  const dragDidMoveRef = useRef(false);

  function onHeaderPointerDown(e) {
    if (!isDraggable) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    dragDidMoveRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = effectivePosition.x;
    const origY = effectivePosition.y;
    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragDidMoveRef.current = true;
      if (dragDidMoveRef.current) {
        setModulePosition(resolvedInstanceId, origX + dx, origY + dy);
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("module-dragging");
    }
    document.body.classList.add("module-dragging");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Module click → focus this module in the narrator. Skipped if a drag just
  // moved the module (the trailing click event still fires otherwise) or if
  // the click landed on an interactive child.
  function onModuleClick(e) {
    if (dragDidMoveRef.current) {
      dragDidMoveRef.current = false;
      return;
    }
    if (e.target.closest(INTERACTIVE_SELECTOR)) return;
    focusModule(slotName);
  }

  const moduleStyle = (freeMode && effectivePosition)
    ? { position: "absolute", left: `${effectivePosition.x}px`, top: `${effectivePosition.y}px` }
    : undefined;

  return (
    <ModuleInstanceContext.Provider value={{ instanceId: resolvedInstanceId, type: slotName }}>
      <div
        ref={moduleRef}
        className={"module " + (meta.kind === "control" ? "control-mod" : "audio-mod") + (isDraggable ? " draggable" : "")}
        data-id={slotName}
        data-instance-id={resolvedInstanceId}
        style={moduleStyle}
        onClick={onModuleClick}
      >
        <span className="screw tl" />
        <span className="screw tr" />
        <span className="screw bl" />
        <span className="screw br" />
        <div className="m-head" onPointerDown={onHeaderPointerDown}>
          <div>
            <div className={"m-kind " + meta.kind}>{KIND_LABEL[meta.kind]}</div>
            <div className="m-title">{meta.title}</div>
          </div>
          {GLYPHS[slotName]}
          {showRemove && (
            <button className="m-remove" title="Patch out" onClick={handleRemove}>✕</button>
          )}
        </div>
        {children}
        {freeMode && resolvedInstanceId && (
          <ModulePorts moduleId={resolvedInstanceId} type={slotName} />
        )}
      </div>
    </ModuleInstanceContext.Provider>
  );
}
