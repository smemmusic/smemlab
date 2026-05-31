import { useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { ModuleInstanceContext } from "./ModuleInstanceContext.js";
import { ModulePorts } from "./ModulePorts.jsx";
import { byType } from "../modules/_registry.js";

const KIND_LABEL = {
  audio:   "Audio · Module",
  control: "Control · Module",
};

// Selectors that identify interactive children — clicks on these should NOT
// trigger module focus (they have their own handlers, e.g. knob dragging,
// port clicks, button presses).
const INTERACTIVE_SELECTOR = "button, input, select, textarea, .knob, .toggle, .selector, .kb, .port, .screen, canvas, svg";

// `type` is the manifest type ("oscillator", "filter", …). `instanceId` is
// the module's id in the store. Modules are absolute-positioned via their
// `position` field; the header acts as the drag handle.
export function Module({ type, instanceId, children }) {
  const manifest = byType(type);

  const removeModuleInstance = useSynthStore((s) => s.removeModuleInstance);
  const setModulePosition    = useSynthStore((s) => s.setModulePosition);
  const focusModule          = useSynthStore((s) => s.focusModule);
  const viewScale            = useSynthStore((s) => s.ui.viewScale);

  const moduleRef = useRef(null);
  const dragDidMoveRef = useRef(false);
  const position = useSynthStore((s) =>
    instanceId ? s.modules.find((m) => m.id === instanceId)?.position : null
  );
  const effectivePosition = position || { x: 0, y: 0 };
  const kind = manifest?.Cls?.KIND;

  if (!manifest) return null;

  function handleRemove(e) {
    e.stopPropagation();
    if (instanceId) removeModuleInstance(instanceId);
  }

  function onHeaderPointerDown(e) {
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
        setModulePosition(instanceId, origX + dx, origY + dy);
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

  const moduleStyle = {
    position: "absolute",
    left: `${effectivePosition.x}px`,
    top:  `${effectivePosition.y}px`,
  };

  return (
    <ModuleInstanceContext.Provider value={{ instanceId, type }}>
      <div
        ref={moduleRef}
        className={"module draggable " + (kind === "control" ? "control-mod" : "audio-mod")}
        data-id={type}
        data-instance-id={instanceId}
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
          {type !== "output" && (
            <button className="m-remove" title="Patch out" onClick={handleRemove}>✕</button>
          )}
        </div>
        {children}
        {instanceId && <ModulePorts moduleId={instanceId} type={type} />}
      </div>
    </ModuleInstanceContext.Provider>
  );
}
