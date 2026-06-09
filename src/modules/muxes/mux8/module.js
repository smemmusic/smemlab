import { MuxModule } from "../MuxModule.js";

// 8→1 multiplexer — the wider sibling of the 4→1: eight CV inputs, a 3-bit gate
// address (`a0`/`a1`/`a2`), and one CV output. Wire a 3-bit counter to the
// address for an 8-step sequencer. See MuxModule for the shared logic.
export class Mux8Module extends MuxModule {
  static INPUTS = 8;
  static ADDR = ["a0", "a1", "a2"];
  static PORTS = MuxModule.portsFor(8, ["a0", "a1", "a2"]);
}
