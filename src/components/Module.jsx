import { MODULE_META, KIND_LABEL } from "../content/moduleMeta.js";
import { PLACARDS } from "../content/placards.js";
import { useSynthStore } from "../store/useSynthStore.js";

const REMOVABLE = new Set(["filter", "amp", "env"]);

export function Module({ id, children }) {
  const meta = MODULE_META[id];
  const removeBlock = useSynthStore((s) => s.removeBlock);

  return (
    <div className={"module " + (meta.kind === "control" ? "control-mod" : "audio-mod")} data-id={id}>
      <span className="screw tl" />
      <span className="screw tr" />
      <span className="screw bl" />
      <span className="screw br" />
      <div className="m-head">
        <div>
          <div className={"m-kind " + meta.kind}>{KIND_LABEL[meta.kind]}</div>
          <div className="m-title">{meta.title}</div>
        </div>
        {REMOVABLE.has(id) && (
          <button className="m-remove" title="Remove" onClick={() => removeBlock(id)}>✕</button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {children}
        <div className="placard" dangerouslySetInnerHTML={{ __html: PLACARDS[id] }} />
      </div>
    </div>
  );
}
