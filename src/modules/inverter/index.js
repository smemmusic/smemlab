import { InverterModule } from "./module.js";
import { InverterPanel } from "./panel.jsx";
import { InverterGlyph } from "./glyph.jsx";

// Free-mode utility, no chapter/canonical integration.
export const Inverter = {
  type: "inverter",
  Cls: InverterModule,
  Panel: InverterPanel,
  meta: { title: "Inverter" },
  defaults: () => ({}),
  placard:
    "A utility that <b>flips</b> the sign of any CV passing through it: a +1 V input becomes −1 V at the output. Mirror an LFO so two destinations sweep in opposite directions, or invert an envelope to fade something in while another fades out.",
  glyph: InverterGlyph,
};
