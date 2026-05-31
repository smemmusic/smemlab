import { GraphEngineFacade } from "./graph/GraphEngineFacade.js";

// getEngine() returns the GraphEngineFacade — a thin wrapper around the
// typed-port GraphEngine that exposes the synchronous methods panels +
// Transport call directly (start/stop, emitGate, playMidi, the visualiser
// hooks). Module + connection lifecycle is owned by the bridge
// (useAudioEngine.js), which diffs the store's modules + connections arrays
// against the live GraphEngine state.
let _engine = null;

export function getEngine() {
  if (_engine === null) _engine = new GraphEngineFacade();
  return _engine;
}

export function getGraphEngine() {
  return getEngine().getGraph();
}
