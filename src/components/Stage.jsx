import { useEffect, useRef } from "react";
import { Rack } from "./Rack.jsx";
import { GateWire } from "./GateWire.jsx";
import { FreeRack } from "./FreeRack.jsx";
import { Palette } from "./Palette.jsx";
import { Wires } from "./Wires.jsx";
import { useSynthStore } from "../store/useSynthStore.js";

// Reserved at the bottom of the stage for the gate wire's drop segment.
// Always reserved (whether the wire is shown or not) to avoid layout shift
// when keyboard + envelope are both patched in.
const WIRE_RESERVE_PX = 42;

// The Stage measures its own size and the rack's natural (unscaled) size each
// time either changes, then applies a uniform CSS transform: scale to the rack
// so it always fits. Scale is clamped to ≤ 1 — the rack never grows past its
// designed size, only shrinks. transform-origin: top left anchors the rack
// to the top-left so it lays out predictably regardless of scale.
export function Stage() {
  const stageRef = useRef(null);
  const freeMode = useSynthStore((s) => s.ui.freeMode);
  const armedSource      = useSynthStore((s) => s.ui.armedSource);
  const focusedSlot      = useSynthStore((s) => s.ui.focusedModuleSlot);
  const clearArmedSource = useSynthStore((s) => s.clearArmedSource);
  const clearSelection   = useSynthStore((s) => s.clearSelection);
  const clearFocus       = useSynthStore((s) => s.clearFocus);

  // Esc clears any armed source mid-patch, then any module focus, then selection.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (armedSource) clearArmedSource();
        else if (focusedSlot) clearFocus();
        else clearSelection();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedSource, focusedSlot, clearArmedSource, clearSelection, clearFocus]);

  // Click on empty stage cancels arm + selection + focus.
  function onStageClick(e) {
    if (e.target === stageRef.current) {
      if (armedSource) clearArmedSource();
      clearSelection();
      clearFocus();
    }
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rack = stage.querySelector(".rack");
    if (!rack) return;

    function fit() {
      // Measure the rack's natural footprint with the transform removed.
      rack.style.transform = "none";
      const naturalW = rack.scrollWidth;
      const naturalH = rack.scrollHeight;
      if (naturalW === 0 || naturalH === 0) return;

      const cs = getComputedStyle(stage);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = Math.max(0, stage.clientWidth - padX);
      // Leave room under the rack for the gate wire's bend.
      const availH = Math.max(0, stage.clientHeight - padY - WIRE_RESERVE_PX);

      const scale = Math.min(1, availW / naturalW, availH / naturalH);
      rack.style.transformOrigin = "top left";
      rack.style.transform = `scale(${scale})`;
    }

    fit();
    // ResizeObserver picks up both viewport changes (via stage) and
    // rack-content changes (block added/removed makes the rack's bounding
    // box change because of `min-width: max-content`).
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    ro.observe(rack);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={stageRef} className={"stage" + (freeMode ? " free-mode" : "")} onClick={onStageClick}>
      {/* Chapter mode: fixed Rack with the legacy decorative gate wire.
          Free mode: unified canvas where every module is positioned + draggable. */}
      {!freeMode && <Rack />}
      {!freeMode && <GateWire containerRef={stageRef} />}
      <FreeRack />
      {freeMode && <Wires containerRef={stageRef} />}
      {freeMode && <Palette />}
    </div>
  );
}
