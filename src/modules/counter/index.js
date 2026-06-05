import { CounterModule } from "./module.js";
import { CounterPanel }  from "./panel.jsx";
import { CounterGlyph }  from "./glyph.jsx";

export const Counter = {
  type: "counter",
  Cls: CounterModule,
  Panel: CounterPanel,
  meta: { title: "2-bit Counter" },
  defaults: () => ({}),
  placard:
    "A 2-bit binary <b>counter</b>. Each pulse on the <b>clock</b> input advances the count 0 → 1 → 2 → 3 → 0; <b>reset</b> snaps it back to 0. The count appears on two gate outputs — <b>bit 0</b> (the ones) and <b>bit 1</b> (the twos) — which together address four positions. Watch the two lights count in binary.",
  glyph: CounterGlyph,
};
