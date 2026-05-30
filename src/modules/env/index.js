import { EnvelopeModule } from "./module.js";
import { EnvelopePanel } from "./panel.jsx";
import { EnvGlyph } from "./glyph.jsx";

export const Env = {
  type: "env",
  Cls: EnvelopeModule,
  Panel: EnvelopePanel,
  meta: { title: "Envelope" },
  defaults: () => ({ a: 0.05, d: 0.2, sustainDb: -8, r: 0.4 }),
  placard:
    "A <b>control</b> signal, not a sound. Driven by the <b>gate</b>: held → attack, decay, sustain; released → release. Its shape is a dB offset that <b>adds</b> to the amplifier's gain from below.",
  glyph: EnvGlyph,
  palette: { include: true, order: 40 },
  canonical: {
    id: "_env",
    blocksFlag: "env",
    defaultPosition: { x: 580, y: 470 },
    // Adding env in chapter mode also brings in the Gate trigger module.
    // (Legacy `addBlock("env")` cascaded `blocks.gate = true`.)
    cascadeOnRemove: [],
    autoConnects: [
      // env.env → amp.level (only when amp is also present).
      { id: "_c_env_amp", from: { canonical: "_env", port: "env" }, to: { canonical: "_amp", port: "level" }, when: { both: ["_amp"] } },
    ],
  },
};
