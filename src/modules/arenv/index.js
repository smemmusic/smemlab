import { ArEnvelopeModule } from "./module.js";
import { ArEnvelopePanel } from "./panel.jsx";
import { ArEnvGlyph } from "./glyph.jsx";

export const ArEnv = {
  type: "arenv",
  Cls: ArEnvelopeModule,
  Panel: ArEnvelopePanel,
  meta: { title: "AR Envelope" },
  defaults: () => ({ a: 0.05, r: 0.3 }),
  placard:
    "A two-stage <b>control</b> envelope — just <b>attack</b> and <b>release</b>. While the gate is held, the envelope ramps up to peak and stays there; when the gate releases, it ramps back to silence. Useful for plucks, claps, and percussive bursts where you don't need a separate sustain level.",
  glyph: ArEnvGlyph,
};
