import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { byType } from "../modules/_registry.js";

// In free mode this is the only rack — every module (canonical + free) renders
// on the absolute-positioned canvas. The Panel for each module comes from its
// manifest, so no per-type imports live here.
export function FreeRack() {
  const modules  = useSynthStore((s) => s.modules);
  const freeMode = useSynthStore((s) => s.ui.freeMode);

  if (!freeMode) return null;

  return (
    <div className="free-rack free-mode-canvas">
      <div className="free-rack-canvas">
        {modules.map((m) => {
          const manifest = byType(m.type);
          if (!manifest) return null;
          const Panel = manifest.Panel;
          return (
            <Module key={m.id} type={m.type} instanceId={m.id}>
              <Panel />
            </Module>
          );
        })}
      </div>
    </div>
  );
}
