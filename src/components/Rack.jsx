import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { HCable } from "./cables/HCable.jsx";
import { VCable } from "./cables/VCable.jsx";
import { OscillatorPanel } from "./modules/OscillatorPanel.jsx";
import { FilterPanel } from "./modules/FilterPanel.jsx";
import { AmplifierPanel } from "./modules/AmplifierPanel.jsx";
import { EnvelopePanel } from "./modules/EnvelopePanel.jsx";
import { LfoPanel } from "./modules/LfoPanel.jsx";
import { KeyboardPanel } from "./modules/KeyboardPanel.jsx";
import { GatePanel } from "./modules/GatePanel.jsx";
import { OutputPanel } from "./modules/OutputPanel.jsx";
import { CV_LABEL_CUTOFF, CV_LABEL_PITCH } from "../content/ui.js";

export function Rack() {
  const blocks  = useSynthStore((s) => s.blocks);
  const playing = useSynthStore((s) => s.playing);

  return (
    <div className={"rack" + (playing ? " playing" : "")}>
      <div className="col">
        <Module id="oscillator"><OscillatorPanel /></Module>
        {blocks.keyboard && (
          <>
            <VCable label={CV_LABEL_PITCH} />
            <Module id="keyboard"><KeyboardPanel /></Module>
          </>
        )}
      </div>

      <HCable />

      {blocks.filter && (
        <>
          <div className="col">
            <Module id="filter"><FilterPanel /></Module>
            {blocks.lfo && (
              <>
                <VCable label={CV_LABEL_CUTOFF} />
                <Module id="lfo"><LfoPanel /></Module>
              </>
            )}
          </div>
          <HCable />
        </>
      )}

      {blocks.amp && (
        <>
          <div className="col">
            <Module id="amp"><AmplifierPanel /></Module>
            {blocks.env && (
              <>
                <VCable />
                <Module id="env"><EnvelopePanel /></Module>
              </>
            )}
          </div>
          <HCable />
        </>
      )}

      <div className="col">
        <Module id="output"><OutputPanel /></Module>
        {blocks.gate && (
          <>
            {/* No VCable here — the wire to the envelope below carries the
                gate signal across to the envelope's column. */}
            <Module id="gate"><GatePanel /></Module>
          </>
        )}
      </div>
    </div>
  );
}
