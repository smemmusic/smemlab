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

  // Apply a zoom step anchored at a screen-space point on the stage.
  // Used by wheel + touch pinch; keeps the model point under (cx, cy) fixed
  // while scaling. driftX/driftY add a translation on top (for touch pinch
  // that also pans by the midpoint drift).
  function applyZoomAt(nextScale, cx, cy, driftX = 0, driftY = 0, baseScale = null, basePan = null) {
    const curScale = baseScale != null
      ? baseScale
      : (zoomModeRef.current === "auto" ? autoScaleRef.current : userScaleRef.current);
    const curPan = basePan != null
      ? basePan
      : (zoomModeRef.current === "auto" ? { x: 0, y: 0 } : panRef.current);
    const modelX = (cx - curPan.x) / curScale;
    const modelY = (cy - curPan.y) / curScale;
    if (zoomModeRef.current === "auto") setZoomMode("manual");
    setUserScale(nextScale);
    setPan({
      x: cx - modelX * nextScale + driftX,
      y: cy - modelY * nextScale + driftY,
    });
  }

  // Touch pinch (mobile). Native touch events expose `event.touches` which
  // gives reliable multi-touch state, where pointer-event multi-touch is
  // inconsistent across mobile browsers. `{ passive: false }` is required
  // because we call preventDefault to suppress the browser's native page
  // pinch-zoom (some Android Chrome builds ignore `touch-action: none`).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let pinch = null;

    function onTouchStart(e) {
      if (e.touches.length < 2) return;
      e.preventDefault();
      // Cancel any in-flight pointer pan so it doesn't fight the pinch.
      if (panGestureRef.current) {
        panGestureRef.current = null;
        stage.classList.remove("panning");
      }
      pointersRef.current.clear();
      pinchGestureRef.current = null;

      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (dist < 1) return;
      const rect = stage.getBoundingClientRect();
      const midScreenX = (t1.clientX + t2.clientX) / 2;
      const midScreenY = (t1.clientY + t2.clientY) / 2;
      const startScale = zoomModeRef.current === "auto" ? autoScaleRef.current : userScaleRef.current;
      const startPan   = zoomModeRef.current === "auto" ? { x: 0, y: 0 } : { ...panRef.current };
      pinch = {
        startDist:   dist,
        startScale,
        startPan,
        midStageX:   midScreenX - rect.left,
        midStageY:   midScreenY - rect.top,
        midScreenX,
        midScreenY,
      };
    }

    function onTouchMove(e) {
      if (!pinch || e.touches.length < 2) return;
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (dist < 1) return;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.startScale * (dist / pinch.startDist)));
      const curMidX = (t1.clientX + t2.clientX) / 2;
      const curMidY = (t1.clientY + t2.clientY) / 2;
      applyZoomAt(
        nextScale,
        pinch.midStageX, pinch.midStageY,
        curMidX - pinch.midScreenX, curMidY - pinch.midScreenY,
        pinch.startScale, pinch.startPan,
      );
    }

    function onTouchEnd(e) {
      if (pinch && e.touches.length < 2) pinch = null;
    }

    stage.addEventListener("touchstart",  onTouchStart, { passive: false });
    stage.addEventListener("touchmove",   onTouchMove,  { passive: false });
    stage.addEventListener("touchend",    onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    return () => {
      stage.removeEventListener("touchstart",  onTouchStart);
      stage.removeEventListener("touchmove",   onTouchMove);
      stage.removeEventListener("touchend",    onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // Wheel-to-zoom (mouse wheel + trackpad pinch). Trackpad pinch on macOS/
  // Windows is delivered as a `wheel` event with `ctrlKey: true` and small
  // deltaY, so the same handler covers both naturally. Anchored to the cursor
  // so the point under the pointer stays in place across the zoom step.
  // Registered imperatively with `{ passive: false }` because React's `onWheel`
  // is passive and can't call preventDefault to suppress browser page zoom.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onWheel(ev) {
      if (ev.target.closest && ev.target.closest("input, select, textarea, .zoom-ctrls, .palette, .modal")) {
        return;
      }
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.002);
      const curScale = zoomModeRef.current === "auto" ? autoScaleRef.current : userScaleRef.current;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, curScale * factor));
      if (nextScale === curScale) return;
      const rect = stage.getBoundingClientRect();
      applyZoomAt(nextScale, ev.clientX - rect.left, ev.clientY - rect.top);
    }

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // Pan via pointer events. Multi-touch pinch is handled separately by the
  // touchstart/touchmove effect above (more reliable on mobile); this handler
  // intentionally only deals with single-pointer pan + click-to-clear.
  const pointersRef     = useRef(new Map());
  const panGestureRef   = useRef(null);  // { pointerId, startX, startY, startPan, didMove }
  // Kept as a ref for the touch-pinch effect to read; not used by pointer pan.
  const pinchGestureRef = useRef(null);

  function beginManualFromAuto() {
    if (zoomModeRef.current !== "auto") return;
    setUserScale(autoScaleRef.current);
    setZoomMode("manual");
  }

  function onStagePointerDown(e) {
    const stage = stageRef.current;
    if (!stage) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If a second pointer (or a touch pinch) is active, don't start a pan.
    if (pointersRef.current.size >= 2) {
      if (panGestureRef.current) {
        stage.classList.remove("panning");
        panGestureRef.current = null;
      }
      return;
    }
    if (!isPanBackground(e.target, stage)) return;
    panGestureRef.current = {
      pointerId: e.pointerId,
      startX:    e.clientX,
      startY:    e.clientY,
      startPan:  zoomModeRef.current === "auto" ? { x: 0, y: 0 } : { ...panRef.current },
      didMove:   false,
    };
    try { stage.setPointerCapture(e.pointerId); } catch {}
  }

  function onStagePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = panGestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    if (pointersRef.current.size >= 2) return; // pinch is in flight; let it drive
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.didMove && Math.abs(dx) + Math.abs(dy) > 3) {
      g.didMove = true;
      beginManualFromAuto();
      stageRef.current?.classList.add("panning");
    }
    if (g.didMove) {
      setPan({ x: g.startPan.x + dx, y: g.startPan.y + dy });
    }
  }

  function onStagePointerEnd(e) {
    pointersRef.current.delete(e.pointerId);
    const g = panGestureRef.current;
    if (g && e.pointerId === g.pointerId) {
      const didMove = g.didMove;
      panGestureRef.current = null;
      stageRef.current?.classList.remove("panning");
      try { stageRef.current?.releasePointerCapture(e.pointerId); } catch {}
      if (!didMove) {
        if (armedSource) clearArmedSource();
        clearSelection();
        clearFocus();
      }
    }
  }

  const displayScale = zoomMode === "auto" ? autoScale : userScale;
  const zoomPct = Math.round(displayScale * 100);

  return (
    <div
      ref={stageRef}
      className={"stage" + (freeMode ? " free-mode" : "")}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerEnd}
      onPointerCancel={onStagePointerEnd}
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
