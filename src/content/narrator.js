// Narrator steps. First entry whose `match(blocks)` returns true wins.
// Add a new step = push a new object to this array.

export const NARRATOR_STEPS = [
  {
    match: (b) => !b.filter && !b.amp,
    step: "Step 1 — The sound source",
    text: "Press <b>POWER</b>. The oscillator is the only part that actually <i>makes</i> sound — watch its raw waveform, try the four shapes, slide the pitch.",
    hint: "Just a raw, continuous tone."
  },
  {
    match: (b) => b.filter && !b.amp,
    step: "Step 2 — Shaping the tone",
    text: "Signal flows <b>oscillator → filter → output</b>. Pull the <b>cutoff</b> down and watch the final scope round off as harmonics vanish.",
    hint: "Compare the two scopes: raw wave in, filtered wave out."
  },
  {
    match: (b) => b.amp && !b.env,
    step: "Step 3 — The amplifier",
    text: "The <b>amplifier</b> applies a gain in <b>decibels</b>: an <b>offset</b>. Push it above <b>0 dB</b> and it amplifies (louder than the source); pull it below and it attenuates. Next, add an envelope whose dB will add to this offset.",
    hint: "Audio path complete: oscillator → filter → amplifier → output."
  },
  {
    match: (b) => b.env,
    step: "Step 4 — Control, from below",
    text: "The <span style='color:var(--control)'>envelope</span> is a dB <b>offset</b> that <b>adds</b> to the gain — its peak rides exactly on the <span style='color:var(--control)'>gain line</span> in the meter. Move the gain and the whole shape slides up or down together. Hold <b>TRIGGER</b> to hear it.",
    hint: "In decibels, offsets add: gain dB + envelope dB."
  }
];
