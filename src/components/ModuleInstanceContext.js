import { createContext, useContext } from "react";

// Per-rendered-module context. Every <Module> mounts a provider with its
// instance id + type; panels (LfoPanel, FilterPanel, etc.) read it via
// `useModuleInstance()` to know which instance they belong to.

export const ModuleInstanceContext = createContext({ instanceId: null, type: null });

export function useModuleInstance() {
  return useContext(ModuleInstanceContext);
}
