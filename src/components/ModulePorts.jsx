import { PortMarker } from "./PortMarker.jsx";
import { PORT_TYPE, PORT_DIR, listStaticPorts } from "../audio/graph/types.js";
import { byType } from "../modules/_registry.js";

// Layout: audio in/out on the left/right edges; everything else (cv, pitch,
// gate) along the bottom edge. Within a side, ports are distributed evenly.
function layoutPorts(ports) {
  const left   = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  const right  = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const bottom = ports.filter((p) => p.type !== PORT_TYPE.AUDIO);
  return { left, right, bottom };
}

export function ModulePorts({ moduleId, type }) {
  const manifest = byType(type);
  if (!manifest) return null;
  const ports = listStaticPorts(manifest.Cls);
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
