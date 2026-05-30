import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { HCable } from "./cables/HCable.jsx";
import { VCable } from "./cables/VCable.jsx";
import { AddSlot } from "./AddSlot.jsx";
import { OscillatorPanel } from "./modules/OscillatorPanel.jsx";
import { FilterPanel } from "./modules/FilterPanel.jsx";
import { AmplifierPanel } from "./modules/AmplifierPanel.jsx";
import { EnvelopePanel } from "./modules/EnvelopePanel.jsx";
import { OutputPanel } from "./modules/OutputPanel.jsx";

export function Rack() {
  const blocks  = useSynthStore((s) => s.blocks);
  const playing = useSynthStore((s) => s.playing);

  return (
    <div className={"rack" + (playing ? " playing" : "")}>
      <div className="col"><Module id="oscillator"><OscillatorPanel /></Module></div>

      <HCable />

      {blocks.filter && (
        <>
          <div className="col"><Module id="filter"><FilterPanel /></Module></div>
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

      <div className="col"><Module id="output"><OutputPanel /></Module></div>

      <AddSlot />
    </div>
  );
}
