import { OscillatorModule } from "./module.js";
import { OscillatorPanel } from "./panel.jsx";
import { OscillatorGlyph } from "./glyph.jsx";

export const Oscillator = {
  type: "oscillator",
  Cls: OscillatorModule,
  Panel: OscillatorPanel,
  meta: { title: "Oscillator" },
  defaults: () => ({ type: "sawtooth", freq: 110, octave: 0 }),
  placard:
    "The only true sound <b>source</b>. The <b>shape</b> sets which harmonics are present; <b>pitch</b> sets the frequency. <b>Noise</b> is the one shape with no pitch — energy at every frequency at once.",
  glyph: OscillatorGlyph,
};
