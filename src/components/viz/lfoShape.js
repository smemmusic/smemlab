// Analytic LFO shape sampler. Returns the LFO's value (-1..+1) for a given
// shape and normalised phase p∈[0,1). Used by both the LFO scope (to draw the
// wave) and the Filter scope (to compute the LFO's contribution to the
// displayed cutoff — Web Audio's getFrequencyResponse ignores modulation
// inputs, so we have to add the LFO's value to the cutoff ourselves).

export function lfoSample(shape, p) {
  switch (shape) {
    case "square":   return p < 0.5 ? 1 : -1;
    case "sawtooth": return 1 - 2 * p;
    case "triangle": return p < 0.5 ? (4 * p - 1) : (3 - 4 * p);
    default:         return Math.sin(p * Math.PI * 2);
  }
}

// Wall-clock phase ∈ [0,1). Use this when you want the LFO's actual current
// value (what the audio engine is producing right now).
export function currentPhase(rate) {
  const p = (performance.now() / 1000) * rate;
  return ((p % 1) + 1) % 1;
}
