import { PortMarker } from "./PortMarker.jsx";
import { PORT_TYPE, PORT_DIR, listStaticPorts } from "../audio/graph/types.js";
import { OscillatorModule } from "../audio/modules/OscillatorModule.js";
import { FilterModule } from "../audio/modules/FilterModule.js";
import { AmplifierModule } from "../audio/modules/AmplifierModule.js";
import { EnvelopeModule } from "../audio/modules/EnvelopeModule.js";
import { LfoModule } from "../audio/modules/LfoModule.js";
import { OutputModule } from "../audio/modules/OutputModule.js";
import { GateModule } from "../audio/modules/GateModule.js";
import { KeyboardModule } from "../audio/modules/KeyboardModule.js";
import { InverterModule } from "../audio/modules/InverterModule.js";
import { CvMixerModule } from "../audio/modules/CvMixerModule.js";

// Maps the legacy slot name (used by Module.jsx for meta/glyph lookups) to
// the corresponding module class. Free-mode types use the same keys, since
// PALETTE_TYPES and Module's slot names align.
const SLOT_TO_CLASS = {
  oscillator: OscillatorModule,
  filter:     FilterModule,
  amp:        AmplifierModule,
  env:        EnvelopeModule,
  lfo:        LfoModule,
  output:     OutputModule,
  gate:       GateModule,
  keyboard:   KeyboardModule,
  inverter:   InverterModule,
  cvmixer:    CvMixerModule,
};

// Layout: audio in/out on the left/right edges; everything else (cv, pitch,
// gate) along the bottom edge. Within a side, ports are distributed evenly.
function layoutPorts(ports) {
  const left   = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  const right  = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const bottom = ports.filter((p) => p.type !== PORT_TYPE.AUDIO);
  return { left, right, bottom };
}

export function ModulePorts({ moduleId, type }) {
  const Cls = SLOT_TO_CLASS[type];
  if (!Cls) return null;
  const ports = listStaticPorts(Cls);
  const { left, right, bottom } = layoutPorts(ports);

  return (
    <>
      {left.length > 0 && (
        <div className="ports ports-left">
          {left.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
      {right.length > 0 && (
        <div className="ports ports-right">
          {right.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
      {bottom.length > 0 && (
        <div className="ports ports-bottom">
          {bottom.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
        </div>
      )}
    </>
  );
}
