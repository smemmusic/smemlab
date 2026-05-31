import { DrumSeqModule } from "./module.js";
import { DrumSeqPanel }  from "./panel.jsx";
import { DrumSeqGlyph }  from "./glyph.jsx";

// Friendly starter pattern: four-on-the-floor on track 1 so a freshly-added
// drum sequencer makes audible sense the moment it's wired to a clock.
function starterPattern() {
  const p = Array.from({ length: 4 }, () => Array(16).fill(false));
  p[0][0] = p[0][4] = p[0][8] = p[0][12] = true;
  return p;
}

export const DrumSeq = {
  type: "drumseq",
  Cls: DrumSeqModule,
  Panel: DrumSeqPanel,
  meta: { title: "Drum Seq" },
  defaults: () => ({ pattern: starterPattern() }),
  placard:
    "A 4-track × 16-step gate <b>sequencer</b>. The <b>clock</b> input advances one step per pulse; <b>reset</b> jumps back to step 1. Each row drives one of the four numbered gate outputs — toggle a step to fire that track's gate when the playhead lands on it. Click a track number to clear that row.",
  glyph: DrumSeqGlyph,
};
