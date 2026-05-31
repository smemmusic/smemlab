import { GateModule } from "./module.js";
import { GatePanel } from "./panel.jsx";
import { GateGlyph } from "./glyph.jsx";

export const Gate = {
  type: "gate",
  Cls: GateModule,
  Panel: GatePanel,
  meta: { title: "Gate" },
  defaults: () => ({}),
  placard:
    "A manual <b>gate</b> source. Hold the button to open the gate — the envelope sees it the same as a key press, the same as the Transport's Gate. Patched to the envelope's trigger input by the green wire.",
  glyph: GateGlyph,
  canonical: {
    id: "_gate",
    blocksFlag: "gate",
    defaultPosition: { x: 870, y: 470 },
    autoConnects: [
      { id: "_c_gate_trig", from: { canonical: "_gate", port: "gate" }, to: { canonical: "_env", port: "trigger" }, when: { both: ["_env"] } },
    ],
  },
};
