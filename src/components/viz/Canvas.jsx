import { useEffect, useLayoutEffect, useRef } from "react";

// Generic canvas with DPR fit + optional RAF loop.
// `draw` is a pure function: (ctx, w, h, data) => void.
// `data` is held in a ref so the RAF callback always reads the latest without re-subscribing.
// `animate=true` runs RAF; `animate=false` redraws on `deps` change.
export function Canvas({ draw, data, animate = true, deps = [], tag, screenClass = "" }) {
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

  useLayoutEffect(() => { once(); /* initial fit + draw */ }, []);

  useEffect(() => {
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
  }, [animate]);

  useEffect(() => {
    if (animate) return;     // RAF handles redraws when animating
    once();
  }, deps);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => once());
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={"screen " + screenClass}>
      {tag && <span className="tag">{tag}</span>}
      <canvas ref={canvasRef} />
      <span className="scanlines" />
      <span className="vignette" />
    </div>
  );
}
