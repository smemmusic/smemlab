// Module placard HTML. Keyed by module id.

export const PLACARDS = {
  oscillator: "The only true sound <b>source</b>. The <b>shape</b> sets which harmonics are present; <b>pitch</b> sets the frequency. <b>Noise</b> is the one shape with no pitch — energy at every frequency at once.",
  filter:     "Removes harmonics. <b>Low-pass</b> keeps everything below the cutoff; flip the switch to <b>high-pass</b> and it keeps everything above. <b>Resonance</b> emphasises frequencies right at the cutoff.",
  amp:        "Applies a gain in <b>decibels</b> — an <b>offset</b>, not a scaling. Above 0 dB it amplifies, below it attenuates. A control signal's dB simply <b>adds</b> to this offset.",
  env:        "A <b>control</b> signal, not a sound. Driven by the <b>gate</b>: held → attack, decay, sustain; released → release. Its shape is a dB offset that <b>adds</b> to the amplifier's gain from below.",
  lfo:        "An oscillator too slow to hear — the same circuit as your first module, only its speed and its destination differ. Patched here into the <b>filter cutoff</b>, it sweeps the tone open and closed.",
  keyboard:   "A manual <b>control</b> source patched to the oscillator's pitch. Each key sends a fixed frequency; the pitch knob is bypassed while this module is patched in. Play with the on-screen keys, your computer keys (<b>A&nbsp;W&nbsp;S&nbsp;E&nbsp;D&nbsp;F&nbsp;T&nbsp;G&nbsp;Y&nbsp;H&nbsp;U&nbsp;J</b>), or shift octaves with <b>Z / X</b>.",
  gate:       "A manual <b>gate</b> source. Hold the button to open the gate — the envelope sees it the same as a key press, the same as the Transport's Gate. Patched to the envelope's trigger input by the green wire.",
  inverter:   "A utility that <b>flips</b> the sign of any CV passing through it: a +1 V input becomes −1 V at the output. Mirror an LFO so two destinations sweep in opposite directions, or invert an envelope to fade something in while another fades out.",
  cvmixer:    "Four CV inputs, each with a <b>gain</b> (in dB) and a <b>phase reverse</b>, summed through a <b>master</b>. Use it to blend modulations: combine two LFOs at different depths, crossfade an envelope against its inverted twin, or scale a single CV with a clean dB knob.",
  output:     "The finished signal reaches the speaker. Compare this scope with the oscillator's — every block along the way has reshaped the wave."
};
