// All non-narrator UI strings. Edit here to change wording without touching components.

export const BRAND = {
  logoAlt: "SMEM",
  title: "Lab"
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
  vol: "Vol"
};

export const CHAPTER_RAIL = {
  title: "Course",
};

export const NARRATOR_UI = {
  chapterPrefix: "Chapter",
  awaitPrefix: "Add the",
  awaitSuffix: "below to continue ↓",
  next: "Next chapter ▸",
  done: "That completes the guided build. Click on Free Build to experiment with everything you've unlocked, or start another journey from the menu.",
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
  displays: {
    sectionTitle: "Displays",
    description:  "Disable every on-module visualiser (oscilloscopes, envelope curves, LFO shapes, gain meters, filter response) to reduce CPU usage on heavy patches.",
    enabledLabel: "Show displays"
  },
  scope: {
    sectionTitle: "Oscilloscope",
    description:  "Stabilises the trace on the X-axis. The trace starts drawing when the signal crosses the threshold in the selected direction.",
    edgeLabel:    "Trigger edge",
    thresholdLabel: "Threshold"
  },
  audio: {
    sectionTitle:    "Audio",
    description:     "Live values from the Web Audio context. Available once the rack is powered on.",
    sampleRateLabel: "Sample rate",
    baseLatencyLabel:   "Base latency",
    outputLatencyLabel: "Output latency",
    inactive: "—"
  }
};

export const LANDING = {
  sub: "Swiss Museum and Centre for Electronic Music Instruments",
  title: "<b>Patch a synthesiser,</b><br/>one step at a time.",
  prose: "Choose a journey to build one step by step — or open Free Build to patch anything you like.",
  pickJourney: "— Pick a journey —",
  freeTitle: "Free Build",
  freeObjective: "Start with an empty rack and patch whatever you like. All modules unlocked.",
  freeStart: "Open free build →",
  journeyStart: "Start →"
};
