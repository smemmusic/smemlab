import { useEffect, useRef } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { getEngine } from "../audio/engineSingleton.js";
import { BRAND, LANDING } from "../content/ui.js";
import { JOURNEYS } from "../content/journeys/index.js";
import { VIZ } from "./viz/gridHelpers.js";

// Welcome screen + journey picker. Stays mounted (no unmount) so the fade-out
// transition can play. Dismissed by any picker action (which sets started=true).
export function Landing() {
  const started      = useSynthStore((s) => s.started);
  const startJourney = useSynthStore((s) => s.startJourney);
  const enterFree    = useSynthStore((s) => s.enterFreeBuild);
  const setPlaying   = useSynthStore((s) => s.setPlaying);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(0);

  // A picker click counts as the user gesture needed to create the AudioContext.
  function pickJourney(id) {
    try { getEngine().start(); setPlaying(true); } catch {}
    startJourney(id);
  }
  function pickFree() {
    try { getEngine().start(); setPlaying(true); } catch {}
    enterFree();
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
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = VIZ.AUDIO_COLOR;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y = h / 2 + Math.sin(x / 90 + t * 2) * 60 * Math.sin(x / 700 + t);
        if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started]);

  return (
    <div
      className={"landing" + (started ? " hide" : "")}
      {...(started ? { inert: "" } : {})}
    >
      <canvas className="bgscope" ref={canvasRef} />
      <div className="card">
        <img className="logo" src={import.meta.env.BASE_URL + "logo.svg"} alt={BRAND.logoAlt} />
        <div className="sub">{LANDING.sub}</div>
        <h1 dangerouslySetInnerHTML={{ __html: LANDING.title }} />
        <p>{LANDING.prose}</p>

        <div className="picker">
          <p className="picker-label">{LANDING.pickJourney}</p>
          <div className="picker-grid">
            {JOURNEYS.map((j) => (
              <button key={j.id} className="journey-card" onClick={() => pickJourney(j.id)}>
                <h3>{j.title}</h3>
                <p>{j.objective}</p>
                <span className="cta">{LANDING.journeyStart}</span>
              </button>
            ))}
            <button className="journey-card free" onClick={pickFree}>
              <h3>{LANDING.freeTitle}</h3>
              <p>{LANDING.freeObjective}</p>
              <span className="cta">{LANDING.freeStart}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
