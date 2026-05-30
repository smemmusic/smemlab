import { useSynthStore } from "../store/useSynthStore.js";
import { MODULE_REGISTRY } from "../audio/graph/GraphEngine.js";
import { MODULE_META } from "../content/moduleMeta.js";

// Free-mode palette: lists every module type with an Add button. Each click
// inserts a fresh instance (uuid id) into the store's modules array using the
// type's default params. The bridge picks it up on the next reconcile.
//
// Module-type → slot-name mapping. The store stores `type: "oscillator"` etc.,
// but MODULE_META is keyed by the slot name. They happen to match for most
// modules; the exception is "amp" which maps to "amp" — also identical.
const PALETTE_TYPES = ["oscillator", "filter", "amp", "env", "lfo"];
// Output is intentionally excluded — there's exactly one speaker. Keyboard /
// gate are UI-only (no engine module) and aren't free-mode-addable yet.

export function Palette() {
  const addModuleInstance = useSynthStore((s) => s.addModuleInstance);

  function add(type) {
    const entry = MODULE_REGISTRY[type];
    if (!entry) return;
    addModuleInstance(type, entry.defaults());
  }

  return (
    <aside className="palette">
      <div className="palette-head">Add module</div>
      <div className="palette-list">
        {PALETTE_TYPES.map((type) => {
          const meta = MODULE_META[type];
          if (!meta) return null;
          return (
            <button
              key={type}
              className={"palette-item " + (meta.kind === "control" ? "control" : "audio")}
              onClick={() => add(type)}
              title={`Add ${meta.title}`}
            >
              <span className="plus" aria-hidden="true">+</span>
              <span className="palette-name">{meta.title}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
