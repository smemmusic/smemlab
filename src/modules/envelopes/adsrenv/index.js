import { AdsrEnvelopeModule } from "./module.js";
import { AdsrEnvelopePanel } from "./panel.jsx";
import { AdsrEnvGlyph } from "./glyph.jsx";

export const AdsrEnv = {
  type: "adsrenv",
  Cls: AdsrEnvelopeModule,
  Panel: AdsrEnvelopePanel,
  meta: { title: "ADSR Envelope" },
  defaults: () => ({ a: 0.05, d: 0.2, s: -8, r: 0.4 }),
  placard:
    "A <b>control</b> signal, not a sound. Driven by the <b>gate</b>: held → attack, decay, sustain; released → release. Its shape is a dB offset that <b>adds</b> to the amplifier's gain from below.",
  glyph: AdsrEnvGlyph,
};
