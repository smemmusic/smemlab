import { AdEnvelopeModule } from "./module.js";
import { AdEnvelopePanel } from "./panel.jsx";
import { AdEnvGlyph } from "./glyph.jsx";

export const AdEnv = {
  type: "adenv",
  Cls: AdEnvelopeModule,
  Panel: AdEnvelopePanel,
  meta: { title: "AD Envelope" },
  defaults: () => ({ a: 0.005, d: 0.4 }),
  placard:
    "A percussive <b>one-shot</b> envelope. Each gate rising edge fires a fixed-length attack-then-decay cycle, regardless of how long the gate stays high — perfect for drums, plucks, and short stabs where you want the sound to fade on its own.",
  glyph: AdEnvGlyph,
};
