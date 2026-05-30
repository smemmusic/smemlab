import { Fragment } from "react";
import { useSynthStore } from "../store/useSynthStore.js";
import { MODULE_META } from "../content/moduleMeta.js";

export function Minimap() {
  const blocks = useSynthStore((s) => s.blocks);

  const chain    = ["oscillator", blocks.filter && "filter", blocks.amp && "amp", "output"].filter(Boolean);
  const controls = [blocks.env && "env"].filter(Boolean);

  return (
    <div className="minimap">
      {chain.map((id, i) => (
        <Fragment key={id}>
          {i > 0 && <span className="conn" />}
          <span className="mm on"><span className="sw" />{MODULE_META[id].title}</span>
        </Fragment>
      ))}
      {controls.map((id) => (
        <Fragment key={id}>
          <span className="conn control" />
          <span className="mm control on"><span className="sw" />{MODULE_META[id].title}</span>
        </Fragment>
      ))}
    </div>
  );
}
