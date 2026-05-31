// Journey registry. Add a new journey:
//   1. Create src/content/journeys/<id>.js with the default export shape
//      from mono-voice.js (id, title, objective, chapters[]).
//   2. Import it here and add it to JOURNEYS.

import monoVoice from "./mono-voice.js";
import kick      from "./kick.js";

export const JOURNEYS = [monoVoice, kick];

export function byId(id) {
  return JOURNEYS.find((j) => j.id === id) || null;
}
