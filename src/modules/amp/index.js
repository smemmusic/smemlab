import { AmplifierModule } from "./module.js";
import { AmplifierPanel } from "./panel.jsx";
import { AmpGlyph } from "./glyph.jsx";

export const Amp = {
  type: "amp",
  Cls: AmplifierModule,
  Panel: AmplifierPanel,
  meta: { title: "Amplifier" },
  defaults: () => ({ level: 0 }),
  placard:
    "Applies a gain in <b>decibels</b> — an <b>offset</b>, not a scaling. Above 0 dB it amplifies, below it attenuates. A control signal's dB simply <b>adds</b> to this offset.",
  glyph: AmpGlyph,
  canonical: {
    id: "_amp",
    blocksFlag: "amp",
    defaultPosition: { x: 580, y: 0 },
    audioChain: { inPort: "input", outPort: "output", order: 3 },
  },
};
