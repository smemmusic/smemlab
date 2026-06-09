import { Mux4Module } from "./module.js";
import { Mux4Panel }  from "./panel.jsx";
import { Mux4Glyph }  from "./glyph.jsx";

export const Mux4 = {
  type: "mux4",
  Cls: Mux4Module,
  Panel: Mux4Panel,
  meta: { title: "4→1 Mux" },
  defaults: () => ({}),
  placard:
    "A 4-to-1 <b>multiplexer</b> — an electronic rotary switch. Four CV inputs, one output, and a 2-bit <b>address</b> (<b>a0</b> + <b>a1</b>) that chooses which input passes through. Wire a counter to the address and the switch steps itself: input 1, 2, 3, 4, round and round.",
  glyph: Mux4Glyph,
};
