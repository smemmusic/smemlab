import { KeyboardModule } from "./module.js";
import { KeyboardPanel } from "./panel.jsx";
import { KeyboardGlyph } from "./glyph.jsx";

export const Keyboard = {
  type: "keyboard",
  Cls: KeyboardModule,
  Panel: KeyboardPanel,
  meta: { title: "Keyboard" },
  defaults: () => ({ octave: 4 }),
  placard:
    "A manual <b>control</b> source patched to the oscillator's pitch. Each key sends a fixed frequency; the pitch knob is bypassed while this module is patched in. Play with the on-screen keys, your computer keys (<b>A&nbsp;W&nbsp;S&nbsp;E&nbsp;D&nbsp;F&nbsp;T&nbsp;G&nbsp;Y&nbsp;H&nbsp;U&nbsp;J</b>), or shift octaves with <b>Z / X</b>.",
  glyph: KeyboardGlyph,
  canonical: {
    id: "_keyboard",
    blocksFlag: "keyboard",
    defaultPosition: { x: 0, y: 470 },
    autoConnects: [
      // V/oct pitch to oscillator (osc always present in canonical chain).
      { id: "_c_kb_pitch", from: { canonical: "_keyboard", port: "pitch" }, to: { canonical: "_osc", port: "pitch"  } },
      // Gate to env trigger when env is present.
      { id: "_c_kb_gate",  from: { canonical: "_keyboard", port: "gate"  }, to: { canonical: "_env", port: "trigger" }, when: { both: ["_env"] } },
    ],
  },
};
