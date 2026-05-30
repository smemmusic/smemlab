import { useSynthStore } from "../store/useSynthStore.js";
import { TRANSPORT, HINTS } from "../content/ui.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Transport() {
  const playing = useSynthStore((s) => s.playing);
  const vol     = useSynthStore((s) => s.vol);
  const hasEnv  = useSynthStore((s) => s.blocks.env);

  const setVol      = useSynthStore((s) => s.setVol);
  const setPlay     = useSynthStore((s) => s.setPlaying);
  const clearGate   = useSynthStore((s) => s.clearGate);
  const setEnvPhase = useSynthStore((s) => s.setEnvPhase);

  function snapshot() {
    const s = useSynthStore.getState();
    return { blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, lfo: s.lfo, vol: s.vol };
  }

  function togglePower() {
    const engine = getEngine();
    if (playing) {
      engine.stop();
      setPlay(false);
      clearGate();
      setEnvPhase("idle");
    } else {
      engine.start(snapshot());
      setPlay(true);
    }
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
        <span className="hint">{hint}</span>
        <div className="vol">
          <span>{TRANSPORT.vol}</span>
          <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(+e.target.value)} />
        </div>
      </div>
    </div>
  );
}
