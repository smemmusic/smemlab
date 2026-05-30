import { AudioEngine } from "./AudioEngine.js";
import { GraphEngine } from "./graph/GraphEngine.js";

let _engine = null;
let _graphEngine = null;

export function getEngine() {
  if (_engine === null) _engine = new AudioEngine();
  return _engine;
}

// Step 2: parallel access to the typed-port engine. Returned regardless of the
// feature flag — only the bridge / chapters / palette decide whether to drive
// it. The flag exists so dev-console smoke tests can opt in (`window.__newEngine = true`).
export function getGraphEngine() {
  if (_graphEngine === null) _graphEngine = new GraphEngine();
  return _graphEngine;
}

// Smoke test for the 2× LFO patch. Run from the dev console:
//   window.__smokeTwoLfos()
// Builds: osc → filter → output, plus 2 LFOs into filter.cutoff (different
// rates so the beat pattern is audible). Returns the engine for further poking.
if (typeof window !== "undefined") {
  window.__smokeTwoLfos = async () => {
    const eng = getGraphEngine();
    eng.start();
    const osc    = eng.addModule({ type: "oscillator", params: { type: "sawtooth", freq: 220 } });
    const filter = eng.addModule({ type: "filter",     params: { cutoff: 800, q: 6, mode: "lowpass" } });
    const out    = eng.addModule({ type: "output",     params: { vol: 60 } });
    const lfo1   = eng.addModule({ type: "lfo",        params: { rate: 0.7, depth: 1.0, shape: "sine" } });
    const lfo2   = eng.addModule({ type: "lfo",        params: { rate: 0.55, depth: 1.0, shape: "triangle" } });
    eng.addConnection({ fromId: osc,    fromPort: "main",   toId: filter, toPort: "input"  });
    eng.addConnection({ fromId: filter, fromPort: "output", toId: out,    toPort: "input"  });
    eng.addConnection({ fromId: lfo1,   fromPort: "cv",     toId: filter, toPort: "cutoff" });
    eng.addConnection({ fromId: lfo2,   fromPort: "cv",     toId: filter, toPort: "cutoff" });
    // eslint-disable-next-line no-console
    console.log("[smoke] 2× LFO patch running. Modules:", { osc, filter, out, lfo1, lfo2 });
    return eng;
  };
}
