import { QuantizerModule } from "./module.js";
import { QuantizerPanel }  from "./panel.jsx";
import { QuantizerGlyph }  from "./glyph.jsx";

export const Quantizer = {
  type: "quantizer",
  Cls: QuantizerModule,
  Panel: QuantizerPanel,
  meta: { title: "Quantizer" },
  defaults: () => ({ range: 24, root: 0, scale: "major" }),
  placard:
    "A pitch <b>quantizer</b>. It takes a freely-varying control voltage and snaps it to the nearest note of a musical <b>scale</b> before passing it on as pitch — so a sequence tuned by ear always lands in tune. Set the <b>root</b> to transpose the scale, the <b>range</b> for how many semitones the full input sweep spans, and pick a <b>scale</b> (chromatic, major, minor, or pentatonic) to taste.",
  glyph: QuantizerGlyph,
};
