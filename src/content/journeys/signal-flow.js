// Signal Flow — the introductory journey.
// Builds a simple monophonic voice step by step, introducing each fundamental
// block of subtractive synthesis (oscillator → filter → amp → envelope → LFO → keyboard).

export default {
  id: "signal-flow",
  title: "Signal Flow",
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
      prose: "Press <b>Power</b>. The <b>oscillator</b> is the only part that actually makes sound. Everything you add later only reshapes what it produces. Watch its raw waveform, switch between the five shapes, and slide the pitch.",
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
      title: "Gain is measured in decibels — an offset, not a multiply.",
      prose: "The <b>amplifier</b> applies a gain in <b>decibels</b>. Push it above <b>0 dB</b> and it amplifies, louder than the source; pull it below and it attenuates. The meter shows that level directly. Soon a control signal's dB will simply add to this.",
      tryit: "Push the gain above 0 dB, then well below it."
    },
    {
      id: "control",
      kind: "control",
      ix: "04",
      nm: "Control vs Audio",
      adds: "env",
      title: "A silent signal that reshapes the sound.",
      prose: "The <span class='cy'>envelope</span> makes no sound on its own. It is a dB <b>offset</b> that <b>adds</b> to the gain — its peak rides exactly on the gain line in the meter. It is driven by the <b>gate</b>: held → attack, decay, sustain; released → release.",
      tryit: "Hold the Gate and watch the contour add to the gain."
    },
    {
      id: "mod",
      kind: "control",
      ix: "05",
      nm: "Modulation",
      adds: "lfo",
      title: "An oscillator too slow to hear becomes a controller.",
      prose: "The <span class='cy'>LFO</span> is the same circuit as your very first module — only slow, and patched somewhere other than the speaker. Here it drives the <b>filter cutoff</b>: its ±1 output is multiplied by the <b>depth</b> (in Hz) and <b>added</b> to whatever the cutoff knob is set to. Same wire, different role.",
      tryit: "Raise the LFO depth and watch the filter breathe."
    },
    {
      id: "play",
      kind: "control",
      ix: "06",
      nm: "Performance",
      adds: "keyboard",
      title: "Stop turning. Start playing.",
      prose: "The <span class='cy'>keyboard</span> is another manual control source — patched into the oscillator's <b>pitch</b>. Each key sends a fixed frequency, so the pitch knob steps aside. Use the on-screen keys, the computer keys <b>A&nbsp;W&nbsp;S&nbsp;E&nbsp;D&nbsp;F&nbsp;T&nbsp;G&nbsp;Y&nbsp;H&nbsp;U&nbsp;J</b>, and shift octaves with <b>Z</b> / <b>X</b>.",
      tryit: "Hold the gate, then play a melody on A S D F G H J."
    }
  ]
};
