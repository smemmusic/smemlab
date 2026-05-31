# SMEM — Modules & Concepts

Scope of what SMEM Lab needs to teach. Each entry is a module to implement, with the parameters/concepts it must expose.

## Audio path

Signal that ultimately reaches the speaker.

- **Oscillator (VCO)** — the sound source.
  - Pitch (frequency)
  - Shape: sine, saw, square, triangle, noise
- **Filter (VCF)** — removes harmonics.
  - Type: low-pass, high-pass
  - Cutoff frequency
  - Resonance (Q)
- **Amplifier (VCA)** — sets level.
  - Gain (dB, offset)
  - Clipping behavior above 0 dB
- **Mixer** — sums audio signals.

## Control path

Signals that *shape* the audio path but are not heard directly. All in dB / CV terms so they add.

- **Gate** — on/off signal from a key being held. High while held, low when released. The envelope listens to it: gate up → attack/decay/sustain, gate down → release.
  - Note: the current UI has a button labeled "Trigger Note" that actually behaves like a gate (press = on, release = off). Worth renaming / re-modelling so the distinction is honest — a true trigger is a brief pulse, a gate is a sustained level. TODO when we revisit the keyboard module.
- **Envelope (ADSR)** — time-shaped offset driven by a gate.
  - Attack, Decay, Sustain, Release
- **Attenuator** — scales a control signal down (0…1).
- **LFO** — slow periodic modulation.
  - Frequency
  - Shape
- **Inverter** — flips a control signal's polarity.
- **Attenuverter** — attenuator that can also invert (−1…+1).
- **Keyboard** — pitch CV source from note input.
- **Keyboard tracking** — keyboard CV routed to non-pitch destinations (e.g. filter cutoff that follows pitch).
- **Mixer** — sums control signals.

## Cross-cutting concepts

Things that aren't modules but need to be in the user's head by the end.

- Audio vs. control signals (same wires, different role).
- **Hertz (Hz)** — cycles per second. Pitch, cutoff, LFO rate all live here. Perceived linearly on a *log* scale (octaves double the number).
- **Decibel (dB)** — logarithmic ratio of level. The unit that makes gain *add* instead of multiply, so amp + envelope + tracking just sum.
- dB as an **offset** that adds, not a multiplier that scales.
- Gate vs. CV (trigger vs. continuous control).
- Patching: any output can drive any input of the matching kind.
