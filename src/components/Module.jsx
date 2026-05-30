import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MODULE_META, KIND_LABEL } from "../content/moduleMeta.js";
import { PLACARDS } from "../content/placards.js";
import { GLYPHS } from "../content/glyphs.jsx";
import { useSynthStore } from "../store/useSynthStore.js";

const REMOVABLE = new Set(["filter", "amp", "env", "lfo"]);

// Hover placard tooltip is rendered through a React portal to <body>. That's
// the only reliable way to escape the stage's overflow container; with the
// placard absolute-inside-module it gets clipped at the stage's edges and the
// chapter rail / minimap end up painting over it.
export function Module({ id, children }) {
  const meta = MODULE_META[id];
  const removeBlock = useSynthStore((s) => s.removeBlock);
  const moduleRef = useRef(null);
  const [tip, setTip] = useState(null);

  function show() {
    const r = moduleRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ left: r.left, top: r.top - 10, width: r.width });
  }

  return (
    <>
      <div
        ref={moduleRef}
        className={"module " + (meta.kind === "control" ? "control-mod" : "audio-mod")}
        data-id={id}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
      >
        <span className="screw tl" />
        <span className="screw tr" />
        <span className="screw bl" />
        <span className="screw br" />
        <div className="m-head">
          <div>
            <div className={"m-kind " + meta.kind}>{KIND_LABEL[meta.kind]}</div>
            <div className="m-title">{meta.title}</div>
          </div>
          {GLYPHS[id]}
          {REMOVABLE.has(id) && (
            <button className="m-remove" title="Patch out" onClick={() => removeBlock(id)}>✕</button>
          )}
        </div>
        {children}
      </div>
      {tip && createPortal(
        <div
          className="placard"
          style={{ left: `${tip.left}px`, top: `${tip.top}px`, width: `${tip.width}px` }}
          dangerouslySetInnerHTML={{ __html: PLACARDS[id] }}
        />,
        document.body
      )}
    </>
  );
}
