// Typed-port graph primitives shared by the audio engine and the UI.
//
// Vocabulary:
//   - A ModuleInstance has a stable `id` (uuid), a `type` ("oscillator"|...),
//     and a `params` bag. Its ports are *declared* by the module subclass via
//     `static PORTS` + `static CONTROLS`; ports are not persisted because they
//     are a property of the type, not the instance.
//   - A Connection wires one (fromId, fromPort) to one (toId, toPort). Ports
//     must agree on `type`. The `id` is also a uuid.
//   - Modules and connections together form a typed graph. The engine owns the
//     runtime nodes; the store owns the JSON-serialisable description.

export const PORT_TYPE = Object.freeze({
  AUDIO: "audio",
  GATE:  "gate",
  // Generic CV: normalised to ±1 (bipolar) or 0..1 (unipolar); destinations
  // sum into AudioParams via a per-input scaler. Knob = baseline, CV = wiggle.
  CV:    "cv",
  // Pitch CV uses the V/oct convention (1.0 = +1 octave, 0.0 = middle C / MIDI 60).
  // Destinations drive an oscillator's `detune` param so multiple pitch sources
  // sum naturally. When wired, pitch *replaces* the freq knob's tuning role —
  // the knob becomes coarse transpose. Type-checked separately from CV so a
  // keyboard's pitch output cannot accidentally land in an LFO's rate input.
  PITCH: "pitch",
});

export const MODULE_KIND = Object.freeze({
  AUDIO:   "audio",     // has at least one audio port
  CONTROL: "control",   // zero audio in/out — emits or consumes only cv/gate
});

export const PORT_DIR = Object.freeze({
  IN:  "in",
  OUT: "out",
});

export const CV_POLARITY = Object.freeze({
  BIPOLAR:  "bipolar",   // -1 .. +1 — e.g. LFO
  UNIPOLAR: "unipolar",  //  0 .. +1 — e.g. envelope
});

export const CONTROL_KIND = Object.freeze({
  KNOB:   "knob",     // continuous; CV input drives an AudioParam directly
  SWITCH: "switch",   // discrete; CV input is quantised to one of CONTROLS.values
});

export const CONTROL_CURVE = Object.freeze({
  LINEAR: "linear",
  EXP:    "exp",      // exponential (musical) sweep over the knob's range
});

// ---- Validation helpers ----

export function isPortType(v) {
  return (
    v === PORT_TYPE.AUDIO ||
    v === PORT_TYPE.GATE  ||
    v === PORT_TYPE.CV    ||
    v === PORT_TYPE.PITCH
  );
}

export function isPortDir(v) {
  return v === PORT_DIR.IN || v === PORT_DIR.OUT;
}

// Returns true if two ports can legally be connected.
// Rules:
//   - source must be an output, destination must be an input
//   - audio ↔ audio, cv ↔ cv, gate ↔ gate (strict)
//   - pitch → pitch (strict)
//   - cv → pitch ALLOWED: pitch inputs interpret any incoming voltage as V/oct,
//     enabling LFO/env into pitch for sweeps, vibrato-as-pitch, chirps.
//   - pitch → cv REJECTED: pitch range exceeds the CV ±1 normalisation
//     contract and would be misscaled by the destination's cvRange scaler.
//   - gate is event-based; never connects to/from audio/cv/pitch.
export function portsCompatible(fromPort, toPort) {
  if (fromPort.dir !== PORT_DIR.OUT) return false;
  if (toPort.dir   !== PORT_DIR.IN)  return false;
  if (fromPort.type === toPort.type) return true;
  if (fromPort.type === PORT_TYPE.CV && toPort.type === PORT_TYPE.PITCH) return true;
  return false;
}

// ---- ID generation ----
// crypto.randomUUID is available in all modern browsers and in Node 19+.
// Tests / SSR environments without it fall back to a non-cryptographic random.
export function newId() {
  const c = (globalThis.crypto || {});
  if (typeof c.randomUUID === "function") return c.randomUUID();
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---- Static port lookup ----
// Returns the unified port spec for a module class (explicit PORTS plus
// CV inputs auto-generated from CONTROLS). Mirrors AudioModule.listPorts()
// but works from the class, not an instance — used by the UI to render
// port markers before the engine has built anything. Controls with
// `cvInput: false` skip the auto-generated port (kept in sync with base).
export function listStaticPorts(Cls) {
  const cvInputs = (Cls.CONTROLS || [])
    .filter((c) => c.cvInput !== false)
    .map((c) => ({
      name: c.name,
      dir:  PORT_DIR.IN,
      type: PORT_TYPE.CV,
      polarity: c.cvPolarity,
      auto: true,
    }));
  return [...(Cls.PORTS || []), ...cvInputs];
}

// ---- Shape factories (for documentation + tests) ----

export function makeModule({ id, type, params = {} }) {
  return { id: id || newId(), type, params: { ...params } };
}

export function makeConnection({ id, fromId, fromPort, toId, toPort }) {
  return { id: id || newId(), fromId, fromPort, toId, toPort };
}
