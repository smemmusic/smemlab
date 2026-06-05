import { Counter3Module } from "./module.js";
import { Counter3Panel }  from "./panel.jsx";
import { Counter3Glyph }  from "./glyph.jsx";

export const Counter3 = {
  type: "counter3",
  Cls: Counter3Module,
  Panel: Counter3Panel,
  meta: { title: "3-bit Counter" },
  defaults: () => ({}),
  placard:
    "A 3-bit binary <b>counter</b>. Each pulse on the <b>clock</b> input advances the count 0 → 7 and wraps; <b>reset</b> returns to 0. Three gate outputs — <b>bit 0</b>, <b>bit 1</b>, <b>bit 2</b> — spell the count in binary and together address eight positions. Wire them to an 8→1 multiplexer's address to step through eight values.",
  glyph: Counter3Glyph,
};
