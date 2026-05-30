import { useSynthStore } from "../store/useSynthStore.js";
import { TRANSPORT } from "../content/ui.js";
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

  function snapshot() {
    const s = useSynthStore.getState();
    return { blocks: s.blocks, osc: s.osc, flt: s.flt, amp: s.amp, env: s.env, vol: s.vol };
  }

  function togglePower() {
    const engine = getEngine();
    if (playing) {
      engine.stop();
      setPlay(false);
      setHeld(false);
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
  }

  function release(e) {
    e.preventDefault();
    if (!hasEnv) return;
    getEngine().noteOff();
    setHeld(false);
    setEnvPhase("rel");
  }

  return (
    <div className="transport">
      <button className={"power" + (playing ? "" : " off")} onClick={togglePower}>
        <span className="dot" />
        <span>{playing ? TRANSPORT.powerOn : TRANSPORT.powerOff}</span>
      </button>
      <button
        className={"trigger" + (held ? " held" : "")}
        disabled={!hasEnv}
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={(e) => { if (held) release(e); }}
      >
        {TRANSPORT.trigger}
      </button>
      <div className="vol">
        <span>{TRANSPORT.vol}</span>
        <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(+e.target.value)} />
      </div>
    </div>
  );
}
