import { useSynthStore } from "../store/useSynthStore.js";
import { Module } from "./Module.jsx";
import { HCable } from "./cables/HCable.jsx";
import { VCable } from "./cables/VCable.jsx";
import { CV_LABEL_CUTOFF, CV_LABEL_PITCH } from "../content/ui.js";
import { byType, deriveBlocks } from "../modules/_registry.js";

// Chapter-mode rack with the hardcoded signal-flow layout. In free mode this
// component does not render (FreeRack takes over the canvas). Panels for each
// slot come from the manifest registry, so adding a new module type doesn't
// require any edit here.
export function Rack() {
  const modules  = useSynthStore((s) => s.modules);
  const playing  = useSynthStore((s) => s.playing);
  const freeMode = useSynthStore((s) => s.ui.freeMode);

  if (freeMode) return null;

  const blocks = deriveBlocks(modules);
  // Decorative cables only render in chapter mode (free mode uses <Wires>).
  const Osc      = byType("oscillator").Panel;
  const Filt     = byType("filter").Panel;
  const Amp      = byType("amp").Panel;
  const Env      = byType("env").Panel;
  const Lfo      = byType("lfo").Panel;
  const Kb       = byType("keyboard").Panel;
  const Gate     = byType("gate").Panel;
  const Output   = byType("output").Panel;

  return (
    <div className={"rack" + (playing ? " playing" : "")}>
      <div className="col">
        <Module type="oscillator"><Osc /></Module>
        {blocks.keyboard && (
          <>
            <VCable label={CV_LABEL_PITCH} />
            <Module type="keyboard"><Kb /></Module>
          </>
        )}
      </div>

      <HCable />

      {blocks.filter && (
        <>
          <div className="col">
            <Module type="filter"><Filt /></Module>
            {blocks.lfo && (
              <>
                <VCable label={CV_LABEL_CUTOFF} />
                <Module type="lfo"><Lfo /></Module>
              </>
            )}
          </div>
          <HCable />
        </>
      )}

      {blocks.amp && (
        <>
          <div className="col">
            <Module type="amp"><Amp /></Module>
            {blocks.env && (
              <>
                <VCable />
                <Module type="env"><Env /></Module>
              </>
            )}
          </div>
          <HCable />
        </>
      )}

      <div className="col">
        <Module type="output"><Output /></Module>
        {blocks.gate && (
          <Module type="gate"><Gate /></Module>
        )}
      </div>
    </div>
  );
}
