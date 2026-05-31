import { ClockModule } from "./module.js";
import { ClockPanel } from "./panel.jsx";
import { ClockGlyph } from "./glyph.jsx";

export const Clock = {
  type: "clock",
  Cls: ClockModule,
  Panel: ClockPanel,
  meta: { title: "Clock" },
  defaults: () => ({ mode: "sync", freq: 2, running: true }),
  placard:
    "A pulse <b>generator</b> for rhythm and sequencing. In <i>Sync</i> mode it ticks at the patch's global BPM; in <i>Free</i> mode the knob sets the rate directly in Hz. The seven outputs along the top emit at fixed divisions and multiplications of that base rate (from <b>/8</b> to <b>×8</b>), all phase-locked so subdivisions line up musically.",
  glyph: ClockGlyph,
};
