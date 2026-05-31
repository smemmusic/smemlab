import { useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { ModuleInstanceContext } from "./ModuleInstanceContext.js";
import { ModulePorts } from "./ModulePorts.jsx";
import { byType, byCanonical } from "../modules/_registry.js";

const KIND_LABEL = {
  audio:   "Audio · Module",
  control: "Control · Module",
};

// Selectors that identify interactive children — clicks on these should NOT
// trigger module focus (they have their own handlers, e.g. knob dragging,
// port clicks, button presses).
const INTERACTIVE_SELECTOR = "button, input, select, textarea, .knob, .toggle, .selector, .kb, .port, .screen, canvas, svg";

// `type` is the manifest type ("oscillator", "filter", …). `instanceId` is
// the canonical id ("_osc") or a free-mode UUID. If omitted, falls through
// to the canonical id from the manifest (chapter-mode default).
export function Module({ type, instanceId, children }) {
  const manifest = byType(type);

  const removeModuleInstance = useSynthStore((s) => s.removeModuleInstance);
  const setModulePosition    = useSynthStore((s) => s.setModulePosition);
  const freeMode             = useSynthStore((s) => s.ui.freeMode);
  const focusModule          = useSynthStore((s) => s.focusModule);
  const viewScale            = useSynthStore((s) => s.ui.viewScale);

  const moduleRef = useRef(null);

  const canonicalId = manifest?.canonical?.id || null;
  const resolvedInstanceId = instanceId || canonicalId;
  const isFreeInstance = resolvedInstanceId && !resolvedInstanceId.startsWith("_");
  const isRequired = manifest?.canonical?.required === true;
  const kind = manifest?.Cls?.KIND;

  const position = useSynthStore((s) =>
    resolvedInstanceId ? s.modules.find((m) => m.id === resolvedInstanceId)?.position : null
  );
  const effectivePosition = position
    || manifest?.canonical?.defaultPosition
    || (isFreeInstance ? { x: 0, y: 0 } : null);

  // Drag is only active in free mode.
  const isDraggable = freeMode && effectivePosition;
  const dragDidMoveRef = useRef(false);

  if (!manifest) return null;

  // In free mode every module is removable except `required` (output).
  // In chapter mode only canonical instances with a `blocksFlag` are removable.
  const removableInChapterMode = isFreeInstance
    || (canonicalId && byCanonical(canonicalId)?.canonical?.blocksFlag != null);
  const showRemove = freeMode ? !isRequired : removableInChapterMode;

  function handleRemove(e) {
    e.stopPropagation();
    if (resolvedInstanceId && !isRequired) removeModuleInstance(resolvedInstanceId);
  }

  function onHeaderPointerDown(e) {
    if (!isDraggable) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    dragDidMoveRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = effectivePosition.x;
    const origY = effectivePosition.y;
    // Divide screen-pixel deltas by the current view scale so the dragged
    // module tracks the cursor when the stage is zoomed in or out.
    const scale = viewScale > 0 ? viewScale : 1;
    function onMove(ev) {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
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

  function onModuleClick(e) {
    if (dragDidMoveRef.current) {
      dragDidMoveRef.current = false;
      return;
    }
    if (e.target.closest(INTERACTIVE_SELECTOR)) return;
    focusModule(type);
  }

  const moduleStyle = (freeMode && effectivePosition)
    ? { position: "absolute", left: `${effectivePosition.x}px`, top: `${effectivePosition.y}px` }
    : undefined;

  return (
    <ModuleInstanceContext.Provider value={{ instanceId: resolvedInstanceId, type }}>
      <div
        ref={moduleRef}
        className={"module " + (kind === "control" ? "control-mod" : "audio-mod") + (isDraggable ? " draggable" : "")}
        data-id={type}
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
            <div className={"m-kind " + kind}>{KIND_LABEL[kind]}</div>
            <div className="m-title">{manifest.meta.title}</div>
          </div>
          {manifest.glyph}
          {showRemove && (
            <button className="m-remove" title="Patch out" onClick={handleRemove}>✕</button>
          )}
        </div>
        {children}
        {freeMode && resolvedInstanceId && (
          <ModulePorts moduleId={resolvedInstanceId} type={type} />
        )}
      </div>
    </ModuleInstanceContext.Provider>
  );
}
