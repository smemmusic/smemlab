import { AudioMixerModule } from "./module.js";
import { AudioMixerPanel } from "./panel.jsx";
import { AudioMixerGlyph } from "./glyph.jsx";

export const AudioMixer = {
  type: "audiomixer",
  Cls: AudioMixerModule,
  Panel: AudioMixerPanel,
  meta: { title: "Audio Mixer" },
  defaults: () => ({
    g1: 0, g2: 0, g3: 0, g4: 0,
    p1: false, p2: false, p3: false, p4: false,
    master: 0,
  }),
  placard:
    "Four audio inputs, each with a <b>gain</b> (in dB) and a <b>phase reverse</b>, summed through a <b>master</b>. Stack multiple oscillators, blend a dry signal with a processed copy, or flip the phase on one feed to cancel against another and sculpt the combined timbre.",
  glyph: AudioMixerGlyph,
};
