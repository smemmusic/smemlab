import { useSynthStore } from "../store/useSynthStore.js";
import { paletteList } from "../modules/_registry.js";

// Free-mode palette: lists every module type listed in PALETTE_ORDER
// (see _registry.js), in array order. Each click adds a fresh instance to
// the store; the bridge picks it up on reconcile.
export function Palette() {
  const addModuleInstance = useSynthStore((s) => s.addModuleInstance);
  const items = paletteList();

  return (
    <aside className="palette">
      <div className="palette-head">Add module</div>
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
    </aside>
  );
}
