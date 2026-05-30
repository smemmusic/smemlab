import { useSynthStore } from "../store/useSynthStore.js";
import { NARRATOR_STEPS } from "../content/narrator.js";

export function useNarratorStep() {
  const blocks = useSynthStore((s) => s.blocks);
  return NARRATOR_STEPS.find((step) => step.match(blocks)) || NARRATOR_STEPS[0];
}
