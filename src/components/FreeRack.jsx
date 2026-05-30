import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { OscillatorPanel } from "./modules/OscillatorPanel.jsx";
import { FilterPanel } from "./modules/FilterPanel.jsx";
import { AmplifierPanel } from "./modules/AmplifierPanel.jsx";
import { EnvelopePanel } from "./modules/EnvelopePanel.jsx";
import { LfoPanel } from "./modules/LfoPanel.jsx";

// Free-mode rack: renders every module whose id is NOT a reserved canonical id
// (i.e. doesn't start with "_"). Canonical chapter modules stay in the
// existing Rack.jsx above. Free instances flow auto-laid-out in a wrap row.

const PANEL_BY_TYPE = {
  oscillator: OscillatorPanel,
  filter:     FilterPanel,
  amp:        AmplifierPanel,
  env:        EnvelopePanel,
  lfo:        LfoPanel,
};

// Module-type to legacy slot name used by Module.jsx for meta lookups, glyphs,
// placards. These match the keys MODULE_META uses.
const TYPE_TO_SLOT = {
  oscillator: "oscillator",
  filter:     "filter",
  amp:        "amp",
  env:        "env",
  lfo:        "lfo",
};

export function FreeRack() {
  const modules = useSynthStore((s) => s.modules);

  const freeModules = modules.filter((m) => !m.id.startsWith("_"));
  if (freeModules.length === 0) return null;

  return (
    <div className="free-rack">
      <div className="free-rack-label">Free modules</div>
      <div className="free-rack-row">
        {freeModules.map((m) => {
          const Panel = PANEL_BY_TYPE[m.type];
          const slot = TYPE_TO_SLOT[m.type];
          if (!Panel || !slot) return null;
          return (
            <Module key={m.id} id={slot} instanceId={m.id}>
              <Panel />
            </Module>
          );
        })}
      </div>
    </div>
  );
}
