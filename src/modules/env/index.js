import { EnvelopeModule } from "./module.js";
import { EnvelopePanel } from "./panel.jsx";
import { EnvGlyph } from "./glyph.jsx";

export const Env = {
  type: "env",
  Cls: EnvelopeModule,
  Panel: EnvelopePanel,
  meta: { title: "ADSR Envelope" },
  defaults: () => ({ a: 0.05, d: 0.2, s: -8, r: 0.4 }),
  placard:
    "A <b>control</b> signal, not a sound. Driven by the <b>gate</b>: held → attack, decay, sustain; released → release. Its shape is a dB offset that <b>adds</b> to the amplifier's gain from below.",
  glyph: EnvGlyph,
};
