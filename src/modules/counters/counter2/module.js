import { CounterModule } from "../CounterModule.js";

// 2-bit binary counter (mod 4). A rising edge on `clock` advances the count
// 0 → 1 → 2 → 3 → 0; a rising edge on `reset` snaps it back to 0. Exposes
// `bit0` (LSB) and `bit1` (MSB) as gate outputs so a 4→1 multiplexer can read
// it as a 2-line address. See CounterModule for the shared logic.
export class Counter2Module extends CounterModule {
  static BITS = 2;
  static PORTS = CounterModule.portsForBits(2);
}
