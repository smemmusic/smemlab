import { createContext, useContext, useMemo } from "react";
import { useSynthStore } from "../store/useSynthStore.js";

// Per-rendered-module context. Every <Module> mounts a provider with its
// instance id, type, and manifest; panels read identity via
// `useModuleInstance()` and params via `useModuleParams()`.

export const ModuleInstanceContext = createContext({ instanceId: null, type: null, manifest: null });

export function useModuleInstance() {
  return useContext(ModuleInstanceContext);
}

// Params for the panel's own module instance, with the module type's manifest
// `defaults()` merged underneath the stored (authored / user-changed) params —
// so a panel always sees a complete set without re-declaring its own
// DEFAULT_PARAMS, and gains any newly-added param automatically. Returns
// `[params, setParam, instanceId]`; `setParam(key, value)` writes one param.
export function useModuleParams() {
  const { instanceId, manifest } = useContext(ModuleInstanceContext);
  const stored = useSynthStore((s) => s.modules.find((m) => m.id === instanceId)?.params);
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  // defaults() may allocate (e.g. drumseq builds a 4×16 grid), so derive it
  // once per module type rather than on every render.
  const defaults = useMemo(() => manifest?.defaults?.() ?? {}, [manifest]);
  const params   = useMemo(() => ({ ...defaults, ...stored }), [defaults, stored]);
  const setParam = useMemo(
    () => (key, value) => setModuleParam(instanceId, key, value),
    [instanceId, setModuleParam],
  );

  return [params, setParam, instanceId];
}
