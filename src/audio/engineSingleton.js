import { AudioEngine } from "./AudioEngine.js";
import { GraphEngine } from "./graph/GraphEngine.js";
import { EngineAdapter } from "./graph/EngineAdapter.js";

// Step 3: getEngine() now returns the EngineAdapter, which exposes the legacy
// AudioEngine API on top of the typed-port GraphEngine. Set
// `window.__legacyEngine = true` BEFORE the module first loads to fall back
// to the hardcoded AudioEngine if the adapter misbehaves.
let _engine = null;
let _graphEngine = null;

export function getEngine() {
  if (_engine === null) {
    const useLegacy = typeof window !== "undefined" && window.__legacyEngine === true;
    _engine = useLegacy ? new AudioEngine() : new EngineAdapter();
  }
  return _engine;
}

// Direct access to the underlying GraphEngine. The adapter holds one
// internally; calling this returns the standalone instance used by the
// smoke test helper below. Once free-mode UI lands (step 5) this is what
// the Palette/Wire components will drive.
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
