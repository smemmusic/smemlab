import { OutputModule } from "./module.js";
import { OutputPanel } from "./panel.jsx";
import { OutputGlyph } from "./glyph.jsx";

// Output is the speaker. Always present, never deletable, not in the palette.
export const Output = {
  type: "output",
  Cls: OutputModule,
  Panel: OutputPanel,
  meta: { title: "Output" },
  defaults: () => ({ vol: 80 }),
  placard:
    "The finished signal reaches the speaker. Compare this scope with the oscillator's — every block along the way has reshaped the wave.",
  glyph: OutputGlyph,
  canonical: {
    id: "_output",
    required: true,
    defaultPosition: { x: 870, y: 0 },
    audioChain: { inPort: "input", outPort: null, order: 4 },
  },
};
