import { AudioEngine } from "./AudioEngine.js";

let _engine = null;

export function getEngine() {
  if (_engine === null) _engine = new AudioEngine();
  return _engine;
}
