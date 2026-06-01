// Puzzle mode helpers. A journey enters "puzzle mode" by declaring a top-level
// `puzzle` block (see mono-voice.js). The block lists, per module instance id,
// which controls remain visible and which ports become puzzle tabs/notches —
// everything else is hidden. Modules and connections still come from the
// existing journey chapters; puzzle mode only changes how they render and how
// they're laid out.

import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "./journeys/index.js";

// Returns the journey's `puzzle` block, or null when the current journey is
// not in puzzle mode (or no journey is active).
export function usePuzzleConfig() {
  return useSynthStore((s) => {
    if (!s.journeyId) return null;
    const j = journeyById(s.journeyId);
    return j?.puzzle ?? null;
  });
}

// Returns the per-instance puzzle entry: `{ controls: [...], ports: [...] }`
// or null when this instance has no entry (or puzzle mode is off).
export function usePuzzleModule(instanceId) {
  return useSynthStore((s) => {
    if (!s.journeyId || !instanceId) return null;
    const j = journeyById(s.journeyId);
    return j?.puzzle?.modules?.[instanceId] ?? null;
  });
}

// Convenience used by panels: returns a `show(name)` predicate. When the
// instance isn't governed by a puzzle entry, every name is visible — so
// existing journeys with no puzzle block continue to render unchanged.
export function usePuzzleShow(instanceId) {
  const entry = usePuzzleModule(instanceId);
  if (!entry) return () => true;
  const set = new Set(entry.controls || []);
  return (name) => set.has(name);
}
