import { CvMixerModule } from "./module.js";
import { CvMixerPanel } from "./panel.jsx";
import { CvMixerGlyph } from "./glyph.jsx";

export const CvMixer = {
  type: "cvmixer",
  Cls: CvMixerModule,
  Panel: CvMixerPanel,
  meta: { title: "CV Mixer" },
  defaults: () => ({
    g1: 0, g2: 0, g3: 0, g4: 0,
    p1: false, p2: false, p3: false, p4: false,
    master: 0,
  }),
  placard:
    "Four CV inputs, each with a <b>gain</b> (in dB) and a <b>phase reverse</b>, summed through a <b>master</b>. Use it to blend modulations: combine two LFOs at different depths, crossfade an envelope against its inverted twin, or scale a single CV with a clean dB knob.",
  glyph: CvMixerGlyph,
  palette: { include: true, order: 90 },
};
