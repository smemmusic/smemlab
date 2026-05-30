import { useEffect } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { getEngine } from "../audio/engineSingleton.js";

function shallow(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!Object.is(a[k], b[k])) return false;
  return true;
}

// Guard module-level so StrictMode double-mounting doesn't create duplicate subscriptions.
let _wired = false;

// Mount once near the root to bridge Zustand state → engine method calls.
// Returns the engine for convenience (also accessible via getEngine()).
export function useAudioEngineBridge() {
  const engine = getEngine();

  useEffect(() => {
    if (_wired) return;
    _wired = true;
    const sub = useSynthStore.subscribe;
    const unsubs = [
      sub((s) => s.osc.type,   (v) => engine.setOscType(v)),
      sub((s) => s.osc.freq,   (v) => engine.setOscFreq(v)),
      sub((s) => s.flt.cutoff, (v) => engine.setCutoff(v)),
      sub((s) => s.flt.q,      (v) => engine.setQ(v)),
      sub((s) => s.amp.db,     (v) => engine.setAmpDb(v)),
      sub((s) => s.env,        (v) => engine.setEnv(v), { equalityFn: shallow }),
      sub((s) => s.vol,        (v) => engine.setVol(v)),
      sub((s) => s.blocks,     (cur, prev) => {
        for (const k of ["env", "amp", "filter"]) {
          if (cur[k] !== prev[k]) (cur[k] ? engine.addBlock(k) : engine.removeBlock(k));
        }
      }, { equalityFn: shallow })
    ];
    return () => {
      _wired = false;
      unsubs.forEach((u) => u());
    };
  }, [engine]);

  return engine;
}
