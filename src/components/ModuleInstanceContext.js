import { createContext, useContext } from "react";

// Per-rendered-module context. Every <Module> mounts a provider with its
// instance id + type; panels (LfoPanel, FilterPanel, etc.) read it via
// `useModuleInstance()` to know which canonical/free instance they belong to.
//
// `instanceId` is either:
//   - a reserved canonical id ("_osc", "_filter", ...) for chapter-mode modules
//   - a crypto.randomUUID() for free-mode-added instances
// `type` is the module type string ("oscillator", "filter", ...).
//
// Default values mean panels can still render outside a provider during
// migration — they'll fall back to the canonical instance for their type.

export const ModuleInstanceContext = createContext({ instanceId: null, type: null });

export function useModuleInstance() {
  return useContext(ModuleInstanceContext);
}
