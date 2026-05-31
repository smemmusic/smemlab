import { OutputModule } from "./module.js";
import { OutputPanel } from "./panel.jsx";
import { OutputGlyph } from "./glyph.jsx";

// The Output module is the speaker — its `input` audio port flows to
// AudioContext.destination. Any patch that wants to be heard needs at least one.
export const Output = {
  type: "output",
  Cls: OutputModule,
  Panel: OutputPanel,
  meta: { title: "Output" },
  defaults: () => ({ vol: 80 }),
  placard:
    "The finished signal reaches the speaker. Compare this scope with the oscillator's — every block along the way has reshaped the wave.",
  glyph: OutputGlyph,
};
