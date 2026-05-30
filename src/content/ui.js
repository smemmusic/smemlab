// All non-narrator UI strings. Edit here to change wording without touching components.

export const BRAND = {
  logoAlt: "SMEM",
  title: "Synth Builder",
  subtitle: "/ signal flow"
};

export const LEGEND = {
  audio: "Audio",
  control: "CV",
  gate: "Gate"
};

export const RESTART = "Start again";

export const TRANSPORT = {
  powerOn: "On",
  powerOff: "Power",
  gate: "Gate",
  gateSub: "hold to sound",
  vol: "Vol"
};

export const HINTS = {
  beforePower: "Press power to begin.",
  noEnv: "A continuous tone — no envelope yet.",
  withEnv: "Hold the Gate module — or the spacebar — to trigger the envelope."
};

export const CHAPTER_RAIL = {
  title: "Course",
};

export const NARRATOR_UI = {
  chapterPrefix: "Chapter",
  awaitPrefix: "Add the",
  awaitSuffix: "below to continue ↓",
  next: "Next chapter ▸",
  done: "That completes the guided build."
};

export const PRESETS_UI = {
  label: "Preset",
  save: "Save",
  delete: "Delete",
  import: "Import",
  export: "Export"
};

export const CV_LABEL = "CV ▸ Gain";              // env → amp default
export const CV_LABEL_CUTOFF = "CV ▸ Cutoff";      // lfo → filter
export const CV_LABEL_PITCH  = "CV ▸ Pitch";       // keyboard → oscillator
export const OUTPUT_TO_SPEAKER = "To speaker";

export const SCOPE_TRIGGER = {
  rising:  { label: "Rising",  short: "▲" },
  falling: { label: "Falling", short: "▼" }
};

export const SETTINGS = {
  open:        "Settings",
  title:       "Settings",
  close:       "Close",
  scope: {
    sectionTitle: "Oscilloscope",
    description:  "Stabilises the trace on the X-axis. The trace starts drawing when the signal crosses the threshold in the selected direction.",
    edgeLabel:    "Trigger edge",
    thresholdLabel: "Threshold"
  }
};

export const LANDING = {
  sub: "Swiss Museum for Electronic Music Instruments",
  title: "A synthesiser is not one machine.<br />It is a chain of small ones.",
  prose: "Build that chain here, one block at a time. Amber wires carry sound. Cyan wires carry control — silent instructions that shape it. Follow the signal from left to right.",
  legendAudio: "Audio — heard",
  legendControl: "Control — silent",
  begin: "Power on ▸"
};
