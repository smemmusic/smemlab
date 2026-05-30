// Module placard HTML. Keyed by module id.

export const PLACARDS = {
  oscillator: "Generates the raw tone. The <b>shape</b> sets which harmonics are present; <b>pitch</b> sets the frequency. The only true sound <b>source</b>.",
  filter: "A low-pass filter removes harmonics <b>above the cutoff</b>, darkening the tone. <b>Resonance</b> emphasises frequencies right at the cutoff.",
  amp: "Applies a gain in <b>decibels</b> — an <b>offset</b>, not a scaling. Above 0 dB it amplifies, below it attenuates. A control signal's dB simply <b>adds</b> to this offset.",
  env: "A <b>control</b> signal, not a sound. Its shape is a dB offset — 0 dB at the peak, falling away over time — that <b>adds</b> to the amplifier's gain from below.",
  output: "The finished signal reaches the speaker. Compare this scope with the oscillator's — every block has reshaped the wave."
};
