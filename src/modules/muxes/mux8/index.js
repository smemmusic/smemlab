import { Mux8Module } from "./module.js";
import { Mux8Panel }  from "./panel.jsx";
import { Mux8Glyph }  from "./glyph.jsx";

export const Mux8 = {
  type: "mux8",
  Cls: Mux8Module,
  Panel: Mux8Panel,
  // Wider panel: 12 ports (8 in + 3 address + out) need room along the edges.
  meta: { title: "8→1 Mux", width: 440 },
  defaults: () => ({}),
  placard:
    "An 8-to-1 <b>multiplexer</b> — an electronic rotary switch with eight positions. Eight CV inputs, one output, and a 3-bit <b>address</b> (<b>a0</b> + <b>a1</b> + <b>a2</b>) that chooses which input passes through. Wire a 3-bit counter to the address and it steps through all eight inputs — an 8-step sequencer.",
  glyph: Mux8Glyph,
};
