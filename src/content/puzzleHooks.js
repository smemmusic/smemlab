// Puzzle mode helpers. A journey enters "puzzle mode" by declaring a top-level
// `puzzle` block (see mono-voice.js). The block lists, per module instance id,
// which controls remain visible and which ports become puzzle tabs/notches —
// everything else is hidden. Modules and connections still come from the
// existing journey chapters; puzzle mode only changes how they render and how
// they're laid out.

import { useSynthStore } from "../store/useSynthStore.js";
import { byId as journeyById } from "./journeys/index.js";

// Returns the journey's `puzzle` block, or null when the current journey is
// not in puzzle mode (or no journey is active). When the visitor has switched
// to the full modular view (`fullModular`), puzzle mode is suppressed even
// though the journey still declares a puzzle block — so every consumer
// (rack class, wires, palette, ports, panels) reverts to modular rendering.
export function usePuzzleConfig() {
  return useSynthStore((s) => {
    if (s.fullModular || !s.journeyId) return null;
    const j = journeyById(s.journeyId);
    return j?.puzzle ?? null;
  });
}

// Returns the per-instance puzzle entry: `{ controls: [...], ports: [...] }`
// or null when this instance has no entry (or puzzle mode is off / suppressed).
export function usePuzzleModule(instanceId) {
  return useSynthStore((s) => {
    if (s.fullModular || !s.journeyId || !instanceId) return null;
    const j = journeyById(s.journeyId);
    return j?.puzzle?.modules?.[instanceId] ?? null;
  });
}

// Whether the active journey declares a puzzle block at all — independent of
// the `fullModular` toggle. Drives the "switch view" affordances, which are
// only meaningful when a puzzle layout exists to switch away from / back to.
export function usePuzzleAvailable() {
  return useSynthStore((s) => {
    if (!s.journeyId) return false;
    return !!journeyById(s.journeyId)?.puzzle;
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
