import { useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { ModuleInstanceContext } from "./ModuleInstanceContext.js";
import { ModulePorts } from "./ModulePorts.jsx";
import { byType } from "../modules/_registry.js";
import { usePuzzleModule } from "../content/puzzleHooks.js";

// Selectors that identify interactive children — clicks on these should NOT
// trigger module focus (they have their own handlers, e.g. knob dragging,
// port clicks, button presses).
const INTERACTIVE_SELECTOR = "button, input, select, textarea, .knob, .toggle, .selector, .kb, .port, .screen, canvas, svg";

// `type` is the manifest type ("oscillator", "filter", …). `instanceId` is
// the module's id in the store. Modules are absolute-positioned via their
// `position` field; the header acts as the drag handle.
export function Module({ type, instanceId, children }) {
  const manifest = byType(type);
  const puzzle   = usePuzzleModule(instanceId);

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
    // Puzzle mode owns the layout (auto-snap) — dragging would just be
    // undone on the next render, so disable it outright.
    if (puzzle) return;
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
        // Clamp the dragged position to non-negative so users can't lose a
        // module off the top-left corner of the rack. The store itself no
        // longer clamps (so the puzzle-mode snap can settle on sub-pixel
        // negative offsets without ping-ponging against the floor).
        setModulePosition(instanceId, Math.max(0, origX + dx), Math.max(0, origY + dy));
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
  // Puzzle mode sizes modules in N×U rack units (see --u-w / --u-h in
  // global.css). The journey's puzzle config declares each module's w and h
  // in those units; we surface them as CSS variables on the module so
  // puzzle.css can resolve the final width/height via calc().
  if (puzzle?.w !== undefined) moduleStyle["--puzzle-w"] = puzzle.w;
  if (puzzle?.h !== undefined) moduleStyle["--puzzle-h"] = puzzle.h;

  // Free-build width: a module may declare a custom panel width in its manifest
  // (meta.width, in px). Override the --mod-w token on the element so the size
  // lives with the module definition instead of a .module[data-id] CSS rule.
  if (manifest.meta.width !== undefined) moduleStyle["--mod-w"] = `${manifest.meta.width}px`;

  // In puzzle mode the rack owns the layout (no drag) and the module reads as
  // a fixed piece, so we drop the `draggable` class and the remove button.
  const classes = [
    "module",
    kind === "control" ? "control-mod" : "audio-mod",
    puzzle ? "puzzle" : "draggable",
  ].join(" ");

  return (
    <ModuleInstanceContext.Provider value={{ instanceId, type }}>
      <div
        ref={moduleRef}
        className={classes}
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
            <div className="m-title">{manifest.meta.title}</div>
          </div>
          {manifest.glyph}
          {!puzzle && type !== "output" && (
            <button className="m-remove" title="Patch out" onClick={handleRemove}>✕</button>
          )}
        </div>
        {children}
        {instanceId && <ModulePorts moduleId={instanceId} type={type} />}
      </div>
    </ModuleInstanceContext.Provider>
  );
}
