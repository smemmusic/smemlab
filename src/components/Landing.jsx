import { useEffect, useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { getEngine } from "../audio/engineSingleton.js";
import { BRAND, LANDING } from "../content/ui.js";

// Welcome screen with a faint animated sine background.
// Stays mounted (no unmount) so the fade-out transition can play.
// Dismissed by setting `started=true` in the store (persisted, so it stays hidden).
export function Landing() {
  const started     = useSynthStore((s) => s.started);
  const setStarted  = useSynthStore((s) => s.setStarted);
  const setPlaying  = useSynthStore((s) => s.setPlaying);
  const canvasRef   = useRef(null);
  const rafRef      = useRef(0);

  // The Power On button counts as the user gesture needed to create the AudioContext.
  function begin() {
    const s = useSynthStore.getState();
    const snapshot = { blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo, vol: s.vol };
    try { getEngine().start(snapshot); setPlaying(true); } catch {}
    setStarted(true);
  }

  useEffect(() => {
    if (started) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");

    function loop() {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = performance.now() / 1000;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffb454";
      ctx.shadowColor = "#ffb454";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 + Math.sin(x / 90 + t * 2) * 60 * Math.sin(x / 700 + t);
        if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started]);

  return (
    <div className={"landing" + (started ? " hide" : "")} aria-hidden={started}>
      <canvas className="bgscope" ref={canvasRef} />
      <div className="card">
        <img className="logo" src="/logo.svg" alt={BRAND.logoAlt} />
        <div className="sub">{LANDING.sub}</div>
        <h1 dangerouslySetInnerHTML={{ __html: LANDING.title }} />
        <p>{LANDING.prose}</p>
        <div className="legend2">
          <span className="a"><i />{LANDING.legendAudio}</span>
          <span className="c"><i />{LANDING.legendControl}</span>
        </div>
        <button className="begin" onClick={begin}>
          <span className="dot" />{LANDING.begin}
        </button>
      </div>
    </div>
  );
}
