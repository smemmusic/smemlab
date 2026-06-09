import { CounterModule } from "../CounterModule.js";

// 3-bit binary counter (mod 8) — the wider sibling of the 2-bit counter, sized
// to address an 8→1 multiplexer. A rising edge on `clock` advances 0 → 7 and
// wraps; `reset` returns to 0. Exposes bit0 (LSB) … bit2 (MSB) as gate outputs.
// See CounterModule for the shared logic.
export class Counter3Module extends CounterModule {
  static BITS = 3;
  static PORTS = CounterModule.portsForBits(3);
}
