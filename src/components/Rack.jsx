import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { byType } from "../modules/_registry.js";

// The rack: absolute-positioned canvas holding every module. Each module's
// position lives on its `position` field in the store; dragging updates it.
export function Rack() {
  const modules = useSynthStore((s) => s.modules);

  return (
    <div className="rack-canvas">
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
  );
}
