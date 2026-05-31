// Signal Flow — the introductory journey.
// Builds a simple monophonic voice step by step, introducing each fundamental
// block of subtractive synthesis (oscillator → filter → amp → envelope → LFO → keyboard).

export default {
  id: "signal-flow",
  title: "Simple Monophonic Voice",
  objective: "Build a simple monophonic voice and follow the signal from oscillator to speaker.",
  difficulty: "beginner",
  estimatedMinutes: 10,
  chapters: [
    {
      id: "source",
      kind: "audio",
      ix: "01",
      nm: "The Source",
      adds: null,
      title: "A synthesiser begins with a single, continuous tone.",
      prose: "The <b>oscillator</b> is the only part that actually makes sound. Everything you add later only reshapes what it produces. Watch its raw waveform, switch between the five shapes, and slide the pitch.",
      tryit: "Switch shapes — including noise — then move the pitch."
    },
    {
      id: "tone",
      kind: "audio",
      ix: "02",
      nm: "Shaping Tone",
      adds: "filter",
      title: "A filter carves harmonics away from the tone.",
      prose: "Signal now flows <b>oscillator → filter → output</b>. A <b>low-pass</b> filter removes harmonics above the cutoff, darkening the sound; flip the switch to <b>high-pass</b> and it does the opposite. <b>Resonance</b> emphasises frequencies right at the cutoff.",
      tryit: "Pull the cutoff down, then throw the LP / HP switch."
    },
    {
      id: "loud",
      kind: "audio",
      ix: "03",
      nm: "Loudness",
      adds: "amp",
      title: "Gain is measured in decibels",
      prose: "The <b>amplifier</b> applies a gain in <b>decibels</b>. Push it above <b>0 dB</b> and it amplifies, louder than the source; pull it below and it attenuates.",
      tryit: "Push the gain above 0 dB, then well below it."
    },
    {
      id: "control",
      kind: "control",
      ix: "04",
      nm: "Control vs Audio",
      adds: "env",
      title: "A silent signal that reshapes the sound.",
      prose: "The <span class='cy'>envelope</span> makes no sound on its own. It is a control signal, meant to modify a parameter of another module. Here we connected it to the gain. When the <b>gate</b> signal is held high: the envelope goes through → attack, decay, sustain; release phases.",
      tryit: "Set the gain on the amplifier to minimum. Hold the Gate and watch the envelope shape the signal's amplitude."
    },
    {
      id: "mod",
      kind: "control",
      ix: "05",
      nm: "Modulation",
      adds: "lfo",
      title: "An oscillator too slow to hear becomes a controller.",
      prose: "The <span class='cy'>LFO</span> is the same circuit as your very first module — only slow, and patched somewhere other than the speaker. Here it drives the <b>filter cutoff</b>: its ±1 output is multiplied by the <b>depth</b>.",
      tryit: "Raise the LFO depth and watch the filter breathe."
    },
    {
      id: "play",
      kind: "control",
      ix: "06",
      nm: "Performance",
      adds: "keyboard",
      title: "Stop turning. Start playing.",
      prose: "The <span class='cy'>keyboard</span> is another manual control source — here patched into the oscillator's <b>pitch</b>. Each key sends a fixed frequency, so the pitch knob steps aside. Use the on-screen keys, the computer keys <b>A&nbsp;W&nbsp;S&nbsp;E&nbsp;D&nbsp;F&nbsp;T&nbsp;G&nbsp;Y&nbsp;H&nbsp;U&nbsp;J</b>, and shift octaves with <b>Z</b> / <b>X</b>.<br/>When pressing a key, this module also emits a gate signal to trigger the envelope.",
      tryit: "Play a melody on A S D F G H J."
    }
  ]
};
