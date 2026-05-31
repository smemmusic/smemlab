import { LfoModule } from "./module.js";
import { LfoPanel } from "./panel.jsx";
import { LfoGlyph } from "./glyph.jsx";

export const Lfo = {
  type: "lfo",
  Cls: LfoModule,
  Panel: LfoPanel,
  meta: { title: "LFO" },
  defaults: () => ({ rate: 5, depth: 0.4, shape: "sine" }),
  placard:
    "An oscillator too slow to hear — the same circuit as your first module, only its speed and its destination differ. Patched here into the <b>filter cutoff</b>, it sweeps the tone open and closed.",
  glyph: LfoGlyph,
};
