import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { OscillatorPanel } from "./modules/OscillatorPanel.jsx";
import { FilterPanel } from "./modules/FilterPanel.jsx";
import { AmplifierPanel } from "./modules/AmplifierPanel.jsx";
import { EnvelopePanel } from "./modules/EnvelopePanel.jsx";
import { LfoPanel } from "./modules/LfoPanel.jsx";
import { KeyboardPanel } from "./modules/KeyboardPanel.jsx";
import { GatePanel } from "./modules/GatePanel.jsx";
import { OutputPanel } from "./modules/OutputPanel.jsx";
import { InverterPanel } from "./modules/InverterPanel.jsx";

// In free mode this is the ONLY rack — every module (canonical + free) renders
// on the absolute-positioned canvas. The chapter Rack is hidden in free mode.
// In chapter mode this component renders nothing (chapter Rack handles canonical
// modules; free instances aren't relevant outside free mode).

const PANEL_BY_TYPE = {
  oscillator: OscillatorPanel,
  filter:     FilterPanel,
  amp:        AmplifierPanel,
  env:        EnvelopePanel,
  lfo:        LfoPanel,
  keyboard:   KeyboardPanel,
  gate:       GatePanel,
  output:     OutputPanel,
  inverter:   InverterPanel,
};

const TYPE_TO_SLOT = {
  oscillator: "oscillator",
  filter:     "filter",
  amp:        "amp",
  env:        "env",
  lfo:        "lfo",
  keyboard:   "keyboard",
  gate:       "gate",
  output:     "output",
  inverter:   "inverter",
};

export function FreeRack() {
  const modules  = useSynthStore((s) => s.modules);
  const freeMode = useSynthStore((s) => s.ui.freeMode);

  if (!freeMode) return null;

  return (
    <div className="free-rack free-mode-canvas">
      <div className="free-rack-canvas">
        {modules.map((m) => {
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
