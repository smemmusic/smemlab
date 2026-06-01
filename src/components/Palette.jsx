import { useEffect, useState } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { paletteList } from "../modules/_registry.js";
import { usePuzzleConfig } from "../content/puzzleHooks.js";

// Free-mode palette: lists every module type listed in PALETTE_ORDER
// (see _registry.js), in array order. Each click adds a fresh instance to
// the store; the bridge picks it up on reconcile. Collapsible — the header
// is a button that toggles the list. Collapse state is purely local (no
// store/persist) because it's a transient UI preference.
//
// Default state follows the mode: free build opens the list (you'll
// reach for it immediately), a journey collapses it (the narrator
// adds modules for you — keep the rack uncluttered).
export function Palette() {
  const addModuleInstance = useSynthStore((s) => s.addModuleInstance);
  const journeyId = useSynthStore((s) => s.journeyId);
  const puzzle = usePuzzleConfig();
  const [open, setOpen] = useState(journeyId == null);
  // Re-sync when the mode flips (back-to-journeys → pick free build, etc.):
  // Palette stays mounted across those transitions, so without this effect
  // the initial useState would never re-run and the default would stick.
  useEffect(() => { setOpen(journeyId == null); }, [journeyId]);
  // Puzzle mode owns the module set (journey deltas) and the layout (auto-snap),
  // so an "Add module" affordance has nothing useful to do — hide it entirely.
  if (puzzle) return null;
  const items = paletteList();

  return (
    <aside className={"palette" + (open ? "" : " collapsed")}>
      <button
        className="palette-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Collapse" : "Add module"}
      >
        <span>Add module</span>
        <span className="palette-toggle" aria-hidden="true">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="palette-list">
          {items.map((m) => (
            <button
              key={m.type}
              className={"palette-item " + (m.Cls.KIND === "control" ? "control" : "audio")}
              onClick={() => addModuleInstance(m.type, m.defaults())}
              title={`Add ${m.meta.title}`}
            >
              <span className="plus" aria-hidden="true">+</span>
              <span className="palette-name">{m.meta.title}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
