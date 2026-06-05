import { MultiplexerModule } from "./module.js";
import { MultiplexerPanel }  from "./panel.jsx";
import { MultiplexerGlyph }  from "./glyph.jsx";

export const Multiplexer = {
  type: "multiplexer",
  Cls: MultiplexerModule,
  Panel: MultiplexerPanel,
  meta: { title: "4→1 Mux" },
  defaults: () => ({}),
  placard:
    "A 4-to-1 <b>multiplexer</b> — an electronic rotary switch. Four CV inputs, one output, and a 2-bit <b>address</b> (<b>a0</b> + <b>a1</b>) that chooses which input passes through. Wire a counter to the address and the switch steps itself: input 1, 2, 3, 4, round and round.",
  glyph: MultiplexerGlyph,
};
