import { useCallback, useEffect, useRef, useState } from "react";
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

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;
const ZOOM_STEP = 1.2;

// "Background" elements that should start a pan when the user clicks them
// (i.e. anything that isn't a module, palette item, wire, or zoom control).
const PAN_BG_CLASSES = ["stage", "rack", "free-rack", "free-rack-canvas", "free-mode-canvas"];
function isPanBackground(target, stageEl) {
  if (!target || !stageEl) return false;
  if (target === stageEl) return true;
  if (target.nodeType !== 1) return false;
  for (const cls of PAN_BG_CLASSES) {
    if (target.classList.contains(cls)) return true;
  }
  return false;
}

// The Stage measures its own size and the rack's natural (unscaled) size each
// time either changes, then applies a transform: translate + scale.
//
// Two modes:
//   - 'auto'   — scale is computed from viewport to fit the rack; pan = 0,0.
//                Scale is clamped to ≤ 1 (rack never grows past designed size).
//   - 'manual' — user has zoomed or panned; we use their scale + pan instead.
//                The first interaction (zoom button or drag) seeds manual state
//                from the current auto-fit values so the view doesn't jump.
export function Stage() {
  const stageRef = useRef(null);
  const freeMode = useSynthStore((s) => s.ui.freeMode);
  const armedSource      = useSynthStore((s) => s.ui.armedSource);
  const focusedSlot      = useSynthStore((s) => s.ui.focusedModuleSlot);
  const clearArmedSource = useSynthStore((s) => s.clearArmedSource);
  const clearSelection   = useSynthStore((s) => s.clearSelection);
  const clearFocus       = useSynthStore((s) => s.clearFocus);
  const setViewScale     = useSynthStore((s) => s.setViewScale);

  const [zoomMode, setZoomMode] = useState("auto");
  const [userScale, setUserScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoScale, setAutoScale] = useState(1);

  // Refs mirror state so the pointer-down handler always sees current values
  // without having to re-bind on every change.
  const zoomModeRef  = useRef(zoomMode);
  const userScaleRef = useRef(userScale);
  const panRef       = useRef(pan);
  const autoScaleRef = useRef(autoScale);
  useEffect(() => { zoomModeRef.current  = zoomMode;  }, [zoomMode]);
  useEffect(() => { userScaleRef.current = userScale; }, [userScale]);
  useEffect(() => { panRef.current       = pan;       }, [pan]);
  useEffect(() => { autoScaleRef.current = autoScale; }, [autoScale]);

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

  // Pick the right scaled element for the current mode. Chapter mode uses
  // Rack.jsx → `.rack`; free mode uses FreeRack.jsx → `.free-rack` (whose
  // inner `.free-rack-canvas` holds absolute-positioned modules).
  const getRackEl = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.querySelector(".rack") || stage.querySelector(".free-rack");
  }, []);

  // Effect 1: recompute auto-fit scale on viewport or rack-content changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function measure() {
      const rack = getRackEl();
      if (!rack) return;
      const prev = rack.style.transform;
      rack.style.transform = "none";
      const naturalW = rack.scrollWidth;
      const naturalH = rack.scrollHeight;
      rack.style.transform = prev;
      if (naturalW === 0 || naturalH === 0) return;

      const cs = getComputedStyle(stage);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = Math.max(0, stage.clientWidth - padX);
      const availH = Math.max(0, stage.clientHeight - padY - WIRE_RESERVE_PX);
      const fit = Math.min(1, availW / naturalW, availH / naturalH);
      setAutoScale(fit);
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    const rack = getRackEl();
    if (rack) ro.observe(rack);
    return () => ro.disconnect();
  }, [freeMode, getRackEl]);

  // Effect 2: write the current scale + pan to the rack as a CSS transform,
  // and mirror the effective scale into the store (so Module drag handlers
  // can scale-correct their pointer deltas).
  useEffect(() => {
    const rack = getRackEl();
    if (!rack) return;
    const scale = zoomMode === "auto" ? autoScale : userScale;
    const px    = zoomMode === "auto" ? 0 : pan.x;
    const py    = zoomMode === "auto" ? 0 : pan.y;
    rack.style.transformOrigin = "top left";
    rack.style.transform = `translate(${px}px, ${py}px) scale(${scale})`;
    setViewScale(scale);
  }, [zoomMode, userScale, pan.x, pan.y, autoScale, freeMode, getRackEl, setViewScale]);

  function currentScale() {
    return zoomModeRef.current === "auto" ? autoScaleRef.current : userScaleRef.current;
  }

  function zoomBy(factor) {
    const base = currentScale();
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, base * factor));
    if (zoomModeRef.current === "auto") {
      // Seed pan/scale from auto so the rack stays in the same screen position.
      setUserScale(next);
      setPan({ x: 0, y: 0 });
      setZoomMode("manual");
    } else {
      setUserScale(next);
    }
  }

  function resetView() {
    setZoomMode("auto");
    setUserScale(1);
    setPan({ x: 0, y: 0 });
  }

  // Pan: pointerdown on a background element starts a drag. Modules, wires,
  // palette, and the zoom controls are all skipped (handled by their own
  // listeners or simply not pannable). If the pointer comes up without
  // moving past the click threshold, treat it as a click on empty stage and
  // clear focus/selection — preserving the pre-pan behavior.
  function onStagePointerDown(e) {
    if (e.button !== 0) return;
    const stage = stageRef.current;
    if (!isPanBackground(e.target, stage)) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPan = zoomModeRef.current === "auto"
      ? { x: 0, y: 0 }
      : { x: panRef.current.x, y: panRef.current.y };
    let didMove = false;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!didMove && Math.abs(dx) + Math.abs(dy) > 3) {
        didMove = true;
        if (zoomModeRef.current === "auto") {
          // Snap pan-start to auto scale so there's no jump on first drag.
          setUserScale(autoScaleRef.current);
          setZoomMode("manual");
        }
        stage?.classList.add("panning");
      }
      if (didMove) {
        setPan({ x: startPan.x + dx, y: startPan.y + dy });
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      stage?.classList.remove("panning");
      if (!didMove) {
        if (armedSource) clearArmedSource();
        clearSelection();
        clearFocus();
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const displayScale = zoomMode === "auto" ? autoScale : userScale;
  const zoomPct = Math.round(displayScale * 100);

  return (
    <div
      ref={stageRef}
      className={"stage" + (freeMode ? " free-mode" : "")}
      onPointerDown={onStagePointerDown}
    >
      {/* Chapter mode: fixed Rack with the legacy decorative gate wire.
          Free mode: unified canvas where every module is positioned + draggable. */}
      {!freeMode && <Rack />}
      {!freeMode && <GateWire containerRef={stageRef} />}
      <FreeRack />
      {freeMode && <Wires containerRef={stageRef} />}
      {freeMode && <Palette />}

      <div
        className="zoom-ctrls"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="zoom-btn"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          title="Zoom out"
          aria-label="Zoom out"
        >−</button>
        <button
          className={"zoom-btn zoom-fit" + (zoomMode === "auto" ? " on" : "")}
          onClick={resetView}
          title="Fit to view"
          aria-label="Fit to view"
        >{zoomPct}%</button>
        <button
          className="zoom-btn"
          onClick={() => zoomBy(ZOOM_STEP)}
          title="Zoom in"
          aria-label="Zoom in"
        >+</button>
      </div>
    </div>
  );
}
