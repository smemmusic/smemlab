import { OffsetModule } from "./module.js";
import { OffsetPanel } from "./panel.jsx";
import { OffsetGlyph } from "./glyph.jsx";

export const Offset = {
  type: "offset",
  Cls: OffsetModule,
  Panel: OffsetPanel,
  meta: { title: "Offset" },
  defaults: () => ({ value: 0 }),
  placard:
    "A constant <b>CV source</b>. Set the knob anywhere from 0 to +1 to emit a steady voltage at the output. Use it to bias any destination — push a filter cutoff up by a fixed amount, hold an envelope target at a chosen level, or sum under a modulating LFO to shift its centre.",
  glyph: OffsetGlyph,
  palette: { include: true, order: 90 },
};
