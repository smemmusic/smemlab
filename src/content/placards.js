// Module placard HTML. Keyed by module id.

export const PLACARDS = {
  oscillator: "The only true sound <b>source</b>. The <b>shape</b> sets which harmonics are present; <b>pitch</b> sets the frequency. <b>Noise</b> is the one shape with no pitch — energy at every frequency at once.",
  filter:     "Removes harmonics. <b>Low-pass</b> keeps everything below the cutoff; flip the switch to <b>high-pass</b> and it keeps everything above. <b>Resonance</b> emphasises frequencies right at the cutoff.",
  amp:        "Applies a gain in <b>decibels</b> — an <b>offset</b>, not a scaling. Above 0 dB it amplifies, below it attenuates. A control signal's dB simply <b>adds</b> to this offset.",
  env:        "A <b>control</b> signal, not a sound. Driven by the <b>gate</b>: held → attack, decay, sustain; released → release. Its shape is a dB offset that <b>adds</b> to the amplifier's gain from below.",
  lfo:        "An oscillator too slow to hear — the same circuit as your first module, only its speed and its destination differ. Patched here into the <b>filter cutoff</b>, it sweeps the tone open and closed.",
  output:     "The finished signal reaches the speaker. Compare this scope with the oscillator's — every block along the way has reshaped the wave."
};
