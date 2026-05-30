import { useSynthStore } from "../store/useSynthStore.js";
import { TRANSPORT, HINTS } from "../content/ui.js";
import { getEngine } from "../audio/engineSingleton.js";
import { isCanonicalPresent } from "../modules/_registry.js";
import { CANONICAL_IDS } from "../store/graphBuilder.js";

export function Transport() {
  const playing = useSynthStore((s) => s.playing);
  const vol     = useSynthStore((s) => s.vol);
  const hasEnv  = useSynthStore((s) => isCanonicalPresent(CANONICAL_IDS.env, s.modules));

  const setVol  = useSynthStore((s) => s.setVol);
  const setPlay = useSynthStore((s) => s.setPlaying);

  function togglePower() {
    const engine = getEngine();
    if (playing) {
      engine.stop();
      setPlay(false);
    } else {
      // Engine pulls modules + connections from the store via the bridge —
      // no snapshot config needed.
      engine.start();
      setPlay(true);
    }
  }

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
