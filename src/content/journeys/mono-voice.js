// Simple Mono Voice — introductory journey.
// Builds a monophonic voice step by step, introducing each fundamental block
// of subtractive synthesis (oscillator → filter → amp → envelope → LFO → keyboard).
//
// Journey shape:
//   initialPatch: { modules, connections }     — graph state when the journey starts
//   chapters[].adds: { modules?, connections?, removeConnections?, setParams? }
//                                              — applied (idempotently) when the user
//                                                clicks the chapter's "Add X" button.
// Module ids and connection ids are stable strings chosen by this file so chapter
// deltas can refer back to earlier additions by id.

export default {
  id: "mono-voice",
  title: "Simple Mono Voice",
  objective: "Build a simple monophonic voice and follow the signal from oscillator to speaker.",
  difficulty: "beginner",
  estimatedMinutes: 10,

  // Puzzle mode — opt-in alternative visual for beginners. Wires disappear,
  // modules render as interlocking puzzle pieces, the rack auto-snaps so
  // connected ports overlap, and panels only show the controls listed below
  // (everything unlisted is hidden, including the named visual elements like
  // "scope" / "response" that aren't params).
  //   anchor — instance id whose position is preserved; everything else is
  //            laid out relative to it via the port-snap walk.
  //   modules — keyed by the instance ids used in this journey:
  //     controls: ordered list of UI element names the panel should show
  //     ports:    list of port names that participate in the patch over the
  //               whole journey (these become puzzle tabs/notches; ports
  //               outside this list don't render at all)
  puzzle: {
    anchor: "osc",
    modules: {
      osc:      { controls: ["scope", "type", "freq"],              ports: ["main", "pitch"] },
      filter:   { controls: ["response", "mode", "cutoff"],         ports: ["input", "output", "cutoff"] },
      amp:      { controls: ["meter", "level"],                     ports: ["input", "output", "level"] },
      env:      { controls: ["scope", "a", "d", "s", "r"],          ports: ["env", "trigger"] },
      trigger:  { controls: ["button"],                             ports: ["gate"] },
      lfo:      { controls: ["scope", "shape", "rate", "depth"],    ports: ["cv"] },
      keyboard: { controls: ["keys"],                               ports: ["pitch", "gate"] },
      output:   { controls: ["scope", "speaker"],                   ports: ["input"] },
    },
  },

  initialPatch: {
    modules: [
      { id: "osc",    type: "oscillator", params: { type: "sine", freq: 110, octave: 0 }, position: { x: 0,    y: 0 } },
      { id: "output", type: "output",     params: { vol: 80 },                                  position: { x: 1200, y: 0 } },
    ],
    connections: [
      { id: "c-osc-out", fromId: "osc", fromPort: "main", toId: "output", toPort: "input" },
    ],
  },

  chapters: [
    {
      id: "source",
      kind: "audio",
      ix: "01",
      nm: "The Source",
      adds: null,
      title: "A synthesiser begins with a single, continuous tone.",
      prose: "The <b>oscillator</b> is the only part that actually makes sound. Everything you add later only reshapes what it produces. Watch its raw waveform, switch between the five shapes, and slide the pitch.",
      tryit: [
        "Switch between the five wave shapes.",
        "Slide the pitch up and down.",
      ],
    },

    {
      id: "tone",
      kind: "audio",
      ix: "02",
      nm: "Shaping Tone",
      addLabel: "Add Filter",
      adds: {
        modules: [
          { id: "filter", type: "filter", params: { cutoff: 550, resonance: 1, mode: "lowpass" }, position: { x: 400, y: 0 } },
        ],
        // Splice the filter into the audio chain: drop osc→output, add osc→filter and filter→output.
        removeConnections: ["c-osc-out"],
        connections: [
          { id: "c-osc-filter",    fromId: "osc",    fromPort: "main",   toId: "filter", toPort: "input" },
          { id: "c-filter-output", fromId: "filter", fromPort: "output", toId: "output", toPort: "input" },
        ],
      },
      title: "A filter carves harmonics away from the tone.",
      prose: "Signal now flows <b>oscillator → filter → output</b>. A <b>low-pass</b> filter removes harmonics above the cutoff, darkening the sound; flip the switch to <b>high-pass</b> and it does the opposite. <b>Resonance</b> emphasises frequencies right at the cutoff.",
      tryit: [
        "Set the oscillator shape to saw or square so the filter's effect is more obvious.",
        "Pull the <b>cutoff</b> down — the sound darkens.",
        "Raise the <b>resonance</b> and sweep the cutoff to hear the peak.",
        "Flip the switch to <b>high-pass</b> — now the lows disappear instead.",
      ],
    },

    {
      id: "loud",
      kind: "audio",
      ix: "03",
      nm: "Loudness",
      addLabel: "Add Amplifier",
      adds: {
        modules: [
          { id: "amp", type: "amp", params: { level: 0 }, position: { x: 800, y: 0 } },
        ],
        // Splice amp between filter and output.
        removeConnections: ["c-filter-output"],
        connections: [
          { id: "c-filter-amp", fromId: "filter", fromPort: "output", toId: "amp",    toPort: "input" },
          { id: "c-amp-output", fromId: "amp",    fromPort: "output", toId: "output", toPort: "input" },
        ],
      },
      title: "Gain is measured in decibels",
      prose: "The <b>amplifier</b> applies a gain in <b>decibels</b>. Push it above <b>0 dB</b> and it amplifies, louder than the source; pull it below and it attenuates.",
      tryit: [
        "Push the gain above <b>0 dB</b> — louder than the source.",
        "Pull it well below <b>0 dB</b> — almost silent.",
        "Park it at <b>0 dB</b> — unity, the source passes through unchanged.",
      ],
    },

    {
      id: "control",
      kind: "control",
      ix: "04",
      nm: "Control vs Audio",
      addLabel: "Add Envelope",
      adds: {
        modules: [
          { id: "env",  type: "env",  params: { a: 0.05, d: 0.2, s: -8, r: 0.4 }, position: { x: 800,  y: 520 } },
          { id: "trigger", type: "trigger", params: {},                                       position: { x: 1200, y: 520 } },
        ],
        connections: [
          { id: "c-env-amp",   fromId: "env",     fromPort: "env",  toId: "amp", toPort: "level"   },
          { id: "c-trig-env",  fromId: "trigger", fromPort: "gate", toId: "env", toPort: "trigger" },
        ],
        // Drop the amp's intrinsic gain to −∞ dB so the envelope's CV is the
        // only thing producing audible output — makes the gate/release effect
        // obvious instead of being masked by the static 0 dB pass-through.
        setParams: { amp: { level: -48 } },
      },
      title: "A silent signal that reshapes the sound.",
      prose: "The <span class='cy'>envelope</span> makes no sound on its own. It is a control signal, meant to modify a parameter of another module. Here we connected it to the gain. When the <b>gate</b> signal is held high: the envelope goes through → attack, decay, sustain; release phases.",
      tryit: [
        "Hold the <b>Trigger</b> — the envelope opens the amp.",
        "Release it and listen as the sound fades out.",
        "Raise the <b>attack</b> for a slower fade-in.",
        "Shorten the <b>release</b> for a snappier tail.",
      ],
    },

    {
      id: "mod",
      kind: "control",
      ix: "05",
      nm: "Modulation",
      addLabel: "Add LFO",
      adds: {
        modules: [
          { id: "lfo", type: "lfo", params: { rate: 1, depth: 0.4, shape: "sine" }, position: { x: 400, y: 520 } },
        ],
        connections: [
          { id: "c-lfo-cutoff", fromId: "lfo", fromPort: "cv", toId: "filter", toPort: "cutoff" },
        ],
      },
      title: "An oscillator too slow to hear becomes a controller.",
      prose: "The <span class='cy'>LFO</span> is the same circuit as your very first module — only slow, and patched somewhere other than the speaker. Here it drives the <b>filter cutoff</b>: its ±1 output is multiplied by the <b>depth</b>.",
      tryit: [
        "Raise the LFO <b>depth</b> — the filter starts to breathe.",
        "Increase the <b>rate</b> for a faster wobble.",
        "Change the LFO's <b>shape</b> — sine sweeps, square steps.",
      ],
    },

    {
      id: "play",
      kind: "control",
      ix: "06",
      nm: "Performance",
      addLabel: "Add Keyboard",
      adds: {
        modules: [
          { id: "keyboard", type: "keyboard", params: { octave: 4 }, position: { x: 0, y: 520 } },
        ],
        connections: [
          { id: "c-kb-pitch", fromId: "keyboard", fromPort: "pitch", toId: "osc", toPort: "pitch"   },
          { id: "c-kb-gate",  fromId: "keyboard", fromPort: "gate",  toId: "env", toPort: "trigger" },
        ],
        // With the keyboard driving pitch, anchor the oscillator at A4=440 so V/oct lands on the right notes.
        setParams: { osc: { freq: 440 } },
      },
      title: "Stop turning. Start playing.",
      prose: "The <span class='cy'>keyboard</span> is another manual control source — here patched into the oscillator's <b>pitch</b>. Each key sends a fixed frequency, so the pitch knob steps aside. Use the on-screen keys, the computer keys <b>A&nbsp;W&nbsp;S&nbsp;E&nbsp;D&nbsp;F&nbsp;T&nbsp;G&nbsp;Y&nbsp;H&nbsp;U&nbsp;J</b>, and shift octaves with <b>Z</b> / <b>X</b>.<br/>When pressing a key, this module also emits a gate signal to trigger the envelope.",
      tryit: [
        "Play a melody on <b>A S D F G H J</b>.",
        "Shift octaves with <b>Z</b> / <b>X</b>.",
        "Hold a key — the envelope opens and stays open.",
      ],
    },
  ],
};
