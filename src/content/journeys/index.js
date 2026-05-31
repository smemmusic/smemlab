// Journey registry. Add a new journey:
//   1. Create src/content/journeys/<id>.js with the default export shape
//      from signal-flow.js (id, title, objective, chapters[]).
//   2. Import it here and add it to JOURNEYS.

import signalFlow from "./signal-flow.js";

export const JOURNEYS = [signalFlow];

export function byId(id) {
  return JOURNEYS.find((j) => j.id === id) || null;
}
