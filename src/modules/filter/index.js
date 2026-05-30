import { FilterModule } from "./module.js";
import { FilterPanel } from "./panel.jsx";
import { FilterGlyph } from "./glyph.jsx";

export const Filter = {
  type: "filter",
  Cls: FilterModule,
  Panel: FilterPanel,
  meta: { title: "Filter" },
  defaults: () => ({ cutoff: 1200, resonance: 1, mode: "lowpass" }),
  placard:
    "Removes harmonics. <b>Low-pass</b> keeps everything below the cutoff; flip the switch to <b>high-pass</b> and it keeps everything above. <b>Resonance</b> emphasises frequencies right at the cutoff.",
  glyph: FilterGlyph,
  palette: { include: true, order: 20 },
  canonical: {
    id: "_filter",
    blocksFlag: "filter",
    defaultPosition: { x: 290, y: 0 },
    audioChain: { inPort: "input", outPort: "output", order: 2 },
  },
};
