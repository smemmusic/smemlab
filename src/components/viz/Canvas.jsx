import { useEffect, useLayoutEffect, useRef } from "react";
import { useSynthStore } from "../../store/useSynthStore.js";

// Generic canvas with DPR fit + optional RAF loop.
// `draw` is a pure function: (ctx, w, h, data) => void.
// `data` is held in a ref so the RAF callback always reads the latest without re-subscribing.
// `animate=true` runs RAF; `animate=false` redraws on `deps` change.
//
// Master gate: when `visualsEnabled` is false in the store we render a
// static "off" placeholder in the same .screen frame — no canvas, no rAF,
// no draw calls — so heavy patches stop paying per-visualiser CPU. Hooks
// stay at the top so React's rules-of-hooks hold across the toggle.
export function Canvas({ draw, data, animate = true, deps = [], tag, screenClass = "" }) {
  const visualsEnabled = useSynthStore((s) => s.visualsEnabled);
  const canvasRef = useRef(null);
  const dataRef   = useRef(data);
  const rafRef    = useRef(0);
  const drawRef   = useRef(draw);

  dataRef.current = data;
  drawRef.current = draw;

  function fit() {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== r.width * dpr || c.height !== r.height * dpr) {
      c.width = r.width * dpr;
      c.height = r.height * dpr;
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  function once() {
    const fitted = fit();
    if (!fitted) return;
    drawRef.current(fitted.ctx, fitted.w, fitted.h, dataRef.current);
  }

  useLayoutEffect(() => {
    if (!visualsEnabled) return;
    once();
  }, [visualsEnabled]);

  useEffect(() => {
    if (!visualsEnabled) return;
    if (!animate) {
      once();
      return;
    }
    function loop() {
      const fitted = fit();
      if (fitted) drawRef.current(fitted.ctx, fitted.w, fitted.h, dataRef.current);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, visualsEnabled]);

  // Non-animated canvases redraw when their caller-supplied `deps` change.
  // Collapse `deps` to a single stable-length key so the dependency array stays
  // a fixed size across renders (a raw `deps` spread of varying length violates
  // the rules-of-hooks contract).
  const depsKey = deps.join("");
  useEffect(() => {
    if (!visualsEnabled || animate) return;     // RAF handles redraws when animating
    once();
  }, [visualsEnabled, animate, depsKey]);

  useEffect(() => {
    if (!visualsEnabled) return;
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => once());
    ro.observe(c);
    return () => ro.disconnect();
  }, [visualsEnabled]);

  if (!visualsEnabled) {
    return (
      <div className={"screen display-off " + screenClass}>
        {tag && <span className="tag">{tag}</span>}
        <span className="display-off-label">Display off</span>
        <span className="scanlines" />
        <span className="vignette" />
      </div>
    );
  }

  return (
    <div className={"screen " + screenClass}>
      {tag && <span className="tag">{tag}</span>}
      <canvas ref={canvasRef} />
      <span className="scanlines" />
      <span className="vignette" />
    </div>
  );
}
