import { useSynthStore } from "../store/useSynthStore.js";
import { TRANSPORT } from "../content/ui.js";
import { getEngine } from "../audio/engineSingleton.js";

export function Transport() {
  const playing = useSynthStore((s) => s.playing);
  const vol     = useSynthStore((s) => s.vol);

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

  return (
    <div className="transport">
      <div className="inner">
        <button className={"power" + (playing ? "" : " off")} onClick={togglePower}>
          <span className="dot" />
          {playing ? TRANSPORT.powerOn : TRANSPORT.powerOff}
        </button>
        <div className="vol">
          <span>{TRANSPORT.vol}</span>
          <input type="range" min="0" max="100" value={vol} onChange={(e) => setVol(+e.target.value)} />
        </div>
      </div>
    </div>
  );
}
