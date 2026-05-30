import { useSynthStore } from "../store/useSynthStore.js";
import { TRANSPORT, HINTS } from "../content/ui.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Transport() {
  const playing = useSynthStore((s) => s.playing);
  const held    = useSynthStore((s) => s.held);
  const vol     = useSynthStore((s) => s.vol);
  const hasEnv  = useSynthStore((s) => s.blocks.env);

  const setVol      = useSynthStore((s) => s.setVol);
  const setPlay     = useSynthStore((s) => s.setPlaying);
  const setHeld     = useSynthStore((s) => s.setHeld);
  const setEnvPhase = useSynthStore((s) => s.setEnvPhase);
  const markStart   = useSynthStore((s) => s.markEnvStart);

  function snapshot() {
    const s = useSynthStore.getState();
    return { blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo, vol: s.vol };
  }

  function togglePower() {
    const engine = getEngine();
    if (playing) {
      engine.stop();
      setPlay(false);
      setHeld(false);
      setEnvPhase("idle");
    } else {
      engine.start(snapshot());
      setPlay(true);
    }
  }

  function press(e) {
    e.preventDefault();
    if (!hasEnv) return;
    const engine = getEngine();
    if (!playing) {
      engine.start(snapshot());
      setPlay(true);
    }
    engine.noteOn();
    setHeld(true);
    setEnvPhase("ad");
    markStart();
  }

  function release(e) {
    e.preventDefault();
    if (!hasEnv) return;
    getEngine().noteOff();
    setHeld(false);
    setEnvPhase("rel");
    markStart();
  }

  // Hint reflects synth state — what's available right now.
  const hint = hasEnv ? HINTS.withEnv : playing ? HINTS.noEnv : HINTS.beforePower;

  return (
    <div className="transport">
      <div className="inner">
        <button className={"power" + (playing ? "" : " off")} onClick={togglePower}>
          <span className="dot" />
          {playing ? TRANSPORT.powerOn : TRANSPORT.powerOff}
        </button>
        <button
          className={"gate" + (held ? " held" : "")}
          disabled={!hasEnv}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={(e) => { if (held) release(e); }}
        >
          {TRANSPORT.gate}
          <span className="sub">{TRANSPORT.gateSub}</span>
        </button>
        <span className="hint">{hint}</span>
        <div className="vol">
          <span>{TRANSPORT.vol}</span>
          <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(+e.target.value)} />
        </div>
      </div>
    </div>
  );
}
