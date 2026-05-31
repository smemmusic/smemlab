import { TriggerModule } from "./module.js";
import { TriggerPanel } from "./panel.jsx";
import { TriggerGlyph } from "./glyph.jsx";

export const Trigger = {
  type: "trigger",
  Cls: TriggerModule,
  Panel: TriggerPanel,
  meta: { title: "Trigger" },
  defaults: () => ({ shortcut: "Space" }),
  placard:
    "A manual <b>gate</b> source. Hold the button (or its assigned keyboard shortcut) to open the gate — the envelope sees it the same as a key press, the same as the Transport's Gate. Patched to the envelope's trigger input by the green wire.",
  glyph: TriggerGlyph,
};
