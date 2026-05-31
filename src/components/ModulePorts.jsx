import { PortMarker } from "./PortMarker.jsx";
import { PORT_TYPE, PORT_DIR, listStaticPorts } from "../audio/graph/types.js";
import { byType } from "../modules/_registry.js";

// Layout:
//   audio in   → left  edge
//   audio out  → right edge
//   CV/pitch/gate OUT → top edge
//   CV/pitch/gate IN  → bottom edge
// Within an edge, ports are distributed evenly.
function layoutPorts(ports) {
  const left   = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  const right  = ports.filter((p) => p.type === PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const top    = ports.filter((p) => p.type !== PORT_TYPE.AUDIO && p.dir === PORT_DIR.OUT);
  const bottom = ports.filter((p) => p.type !== PORT_TYPE.AUDIO && p.dir === PORT_DIR.IN);
  return { left, right, top, bottom };
}

export function ModulePorts({ moduleId, type }) {
  const manifest = byType(type);
  if (!manifest) return null;
  const ports = listStaticPorts(manifest.Cls);
  const { left, right, top, bottom } = layoutPorts(ports);

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
      {top.length > 0 && (
        <div className="ports ports-top">
          {top.map((p) => <PortMarker key={p.name} moduleId={moduleId} port={p} />)}
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
