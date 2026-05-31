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
      const curScale = zoomModeRef.current === "auto"
        ? autoScaleRef.current
        : userScaleRef.current;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, curScale * factor));
      if (nextScale === curScale) return;

      const rect = stage.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      const curPan = zoomModeRef.current === "auto"
        ? { x: 0, y: 0 }
        : panRef.current;

      // Keep the model point under the cursor fixed:
      //   modelX = (cursorX - panX) / scale
      //   newPanX = cursorX - modelX * newScale
      const modelX = (cx - curPan.x) / curScale;
      const modelY = (cy - curPan.y) / curScale;
      const nextPan = {
        x: cx - modelX * nextScale,
        y: cy - modelY * nextScale,
      };

      if (zoomModeRef.current === "auto") setZoomMode("manual");
      setUserScale(nextScale);
      setPan(nextPan);
    }

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  // Active touches/pointers on the stage. Used to detect a one-finger pan
  // (size === 1) vs a two-finger pinch (size >= 2). A ref Map keeps state
  // across renders without re-binding listeners.
  const pointersRef     = useRef(new Map());
  const panGestureRef   = useRef(null);  // { pointerId, startX, startY, startPan, didMove }
  const pinchGestureRef = useRef(null);  // { startDist, startScale, startPan, startMidStageX, startMidStageY, startMidScreenX, startMidScreenY }

  function beginManualFromAuto() {
    if (zoomModeRef.current !== "auto") return;
    setUserScale(autoScaleRef.current);
    setZoomMode("manual");
  }

  function onStagePointerDown(e) {
    const stage = stageRef.current;
    if (!stage) return;
    // Right-click / middle-click on mouse: ignore (let context menu work).
    if (e.pointerType === "mouse" && e.button !== 0) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch supersedes a one-finger pan.
    if (pointersRef.current.size >= 2) {
      if (panGestureRef.current) {
        stage.classList.remove("panning");
        panGestureRef.current = null;
      }
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < 1) return;
      const rect = stage.getBoundingClientRect();
      const midScreenX = (p1.x + p2.x) / 2;
      const midScreenY = (p1.y + p2.y) / 2;
      const curScale = zoomModeRef.current === "auto" ? autoScaleRef.current : userScaleRef.current;
      const curPan   = zoomModeRef.current === "auto" ? { x: 0, y: 0 } : { ...panRef.current };
      beginManualFromAuto();
      pinchGestureRef.current = {
        startDist:      dist,
        startScale:     curScale,
        startPan:       curPan,
        startMidStageX: midScreenX - rect.left,
        startMidStageY: midScreenY - rect.top,
        startMidScreenX: midScreenX,
        startMidScreenY: midScreenY,
      };
      return;
    }

    // Single-pointer: may become a pan (only on a background target).
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

    const stage = stageRef.current;
    if (pinchGestureRef.current && pointersRef.current.size >= 2) {
      const p = pinchGestureRef.current;
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < 1) return;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, p.startScale * (dist / p.startDist)));
      // Keep the model point under the original midpoint fixed (cursor anchor),
      // plus translate by the midpoint drift so two-finger pan-while-pinching works.
      const modelX = (p.startMidStageX - p.startPan.x) / p.startScale;
      const modelY = (p.startMidStageY - p.startPan.y) / p.startScale;
      const curMidX = (p1.x + p2.x) / 2;
      const curMidY = (p1.y + p2.y) / 2;
      const driftX = curMidX - p.startMidScreenX;
      const driftY = curMidY - p.startMidScreenY;
      setUserScale(nextScale);
      setPan({
        x: p.startMidStageX - modelX * nextScale + driftX,
        y: p.startMidStageY - modelY * nextScale + driftY,
      });
      return;
    }

    const g = panGestureRef.current;
    if (g && e.pointerId === g.pointerId) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (!g.didMove && Math.abs(dx) + Math.abs(dy) > 3) {
        g.didMove = true;
        beginManualFromAuto();
        stage?.classList.add("panning");
      }
      if (g.didMove) {
        setPan({ x: g.startPan.x + dx, y: g.startPan.y + dy });
      }
    }
  }

  function onStagePointerEnd(e) {
    pointersRef.current.delete(e.pointerId);

    // When one finger of a pinch lifts, end the pinch (don't try to fall back
    // to pan — that gets jumpy).
    if (pinchGestureRef.current && pointersRef.current.size < 2) {
      pinchGestureRef.current = null;
    }

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
