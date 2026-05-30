import { AttenuatorModule } from "./module.js";
import { AttenuatorPanel } from "./panel.jsx";
import { AttenuatorGlyph } from "./glyph.jsx";

export const Attenuator = {
  type: "attenuator",
  Cls: AttenuatorModule,
  Panel: AttenuatorPanel,
  meta: { title: "Attenuator" },
  defaults: () => ({ amount: 1 }),
  placard:
    "A unipolar attenuator. Sweep one knob from <b>silent</b> (left) to <b>fully passed</b> (right) to scale any CV down to a chosen amount. The CV equivalent of a volume control — use it to tame an over-strong modulation source without flipping its sign.",
  glyph: AttenuatorGlyph,
  palette: { include: true, order: 82 },
};
