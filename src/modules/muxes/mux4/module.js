import { MuxModule } from "../MuxModule.js";

// 4→1 multiplexer (sequential switch): four CV inputs, a 2-bit gate address
// (`a0` = ones, `a1` = twos), and one CV output. Wire a 2-bit counter to the
// address and the switch steps itself through inputs 1–4. See MuxModule for the
// shared logic.
export class Mux4Module extends MuxModule {
  static INPUTS = 4;
  static ADDR = ["a0", "a1"];
  static PORTS = MuxModule.portsFor(4, ["a0", "a1"]);
}
