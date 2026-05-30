// Module visual chrome metadata.

export const MODULE_META = {
  oscillator: { kind: "audio",   title: "Oscillator" },
  filter:     { kind: "audio",   title: "Filter" },
  amp:        { kind: "audio",   title: "Amplifier" },
  env:        { kind: "control", title: "Envelope" },
  lfo:        { kind: "control", title: "LFO" },
  keyboard:   { kind: "control", title: "Keyboard" },
  gate:       { kind: "control", title: "Gate" },
  inverter:   { kind: "control", title: "Inverter" },
  cvmixer:    { kind: "control", title: "CV Mixer" },
  output:     { kind: "audio",   title: "Output" }
};

export const KIND_LABEL = {
  audio: "Audio · Module",
  control: "Control · Module"
};
