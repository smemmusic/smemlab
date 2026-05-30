import { AttenuverterModule } from "./module.js";
import { AttenuverterPanel } from "./panel.jsx";
import { AttenuverterGlyph } from "./glyph.jsx";

export const Attenuverter = {
  type: "attenuverter",
  Cls: AttenuverterModule,
  Panel: AttenuverterPanel,
  meta: { title: "Attenuverter" },
  defaults: () => ({ amount: 0 }),
  placard:
    "A bipolar attenuator. Sweep one knob from <b>fully inverted</b> (left) through <b>silent</b> (centre) to <b>fully passed</b> (right). Use it to scale, mute, or flip any CV — the universal middle stage between any source and any destination.",
  glyph: AttenuverterGlyph,
  palette: { include: true, order: 85 },
};
