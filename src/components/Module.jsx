import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MODULE_META, KIND_LABEL } from "../content/moduleMeta.js";
import { PLACARDS } from "../content/placards.js";
import { GLYPHS } from "../content/glyphs.jsx";
import { useSynthStore } from "../store/useSynthStore.js";
import { ModuleInstanceContext } from "./ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../store/graphBuilder.js";
import { ModulePorts } from "./ModulePorts.jsx";

// `slotName` is the legacy block name (oscillator/filter/amp/env/lfo/keyboard/gate/output)
// used to look up meta + glyphs + placard + chapter removal semantics.
// `instanceId` is the canonical or free-mode module id. If omitted, the
// canonical id for `slotName` is used (chapter-mode default).
const REMOVABLE_SLOTS = new Set(["filter", "amp", "env", "lfo", "keyboard", "gate"]);
const SLOT_TO_BLOCK = {
  filter: "filter", amp: "amp", env: "env", lfo: "lfo",
  keyboard: "keyboard", gate: "gate",
};

// Map a slot name to the corresponding canonical instance id (or null if
// the slot has no engine module — keyboard/gate are UI-only).
const SLOT_TO_CANONICAL = {
  oscillator: CANONICAL_IDS.osc,
  filter:     CANONICAL_IDS.filter,
  amp:        CANONICAL_IDS.amp,
  env:        CANONICAL_IDS.env,
  lfo:        CANONICAL_IDS.lfo,
  output:     CANONICAL_IDS.output,
  keyboard:   null,
  gate:       null,
};

export function Module({ id, instanceId, children }) {
  const slotName = id;
  const meta = MODULE_META[slotName];
  const removeBlock = useSynthStore((s) => s.removeBlock);
  const removeModuleInstance = useSynthStore((s) => s.removeModuleInstance);
  const freeMode = useSynthStore((s) => s.ui.freeMode);
  const moduleRef = useRef(null);
  const [tip, setTip] = useState(null);

  // Resolve the actual instance id this module renders. Free-mode panels pass
  // an explicit id (uuid); chapter-mode panels omit it and fall through to the
  // canonical slot id.
  const resolvedInstanceId = instanceId || SLOT_TO_CANONICAL[slotName] || null;
  const isFreeInstance = resolvedInstanceId && !resolvedInstanceId.startsWith("_");

  function handleRemove() {
    if (isFreeInstance) {
      removeModuleInstance(resolvedInstanceId);
    } else if (REMOVABLE_SLOTS.has(slotName)) {
      removeBlock(SLOT_TO_BLOCK[slotName]);
    }
  }

  function show() {
    const r = moduleRef.current?.getBoundingClientRect();
    if (!r) return;
    const above = meta.kind === "control";
    setTip({
      left: r.left,
      top:  above ? r.top - 10 : r.bottom + 10,
      width: r.width,
      above
    });
  }

  // The free-mode close button is always available; chapter-mode keeps the
  // existing rule (only certain slots are removable via the chapter flow).
  const showRemove = isFreeInstance || REMOVABLE_SLOTS.has(slotName);

  return (
    <ModuleInstanceContext.Provider value={{ instanceId: resolvedInstanceId, type: slotName }}>
      <div
        ref={moduleRef}
        className={"module " + (meta.kind === "control" ? "control-mod" : "audio-mod")}
        data-id={slotName}
        data-instance-id={resolvedInstanceId}
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
          {GLYPHS[slotName]}
          {showRemove && (
            <button className="m-remove" title="Patch out" onClick={handleRemove}>✕</button>
          )}
        </div>
        {children}
        {freeMode && resolvedInstanceId && (
          <ModulePorts moduleId={resolvedInstanceId} type={slotName} />
        )}
      </div>
      {tip && createPortal(
        <div
          className={"placard" + (tip.above ? " above" : "")}
          style={{ left: `${tip.left}px`, top: `${tip.top}px`, width: `${tip.width}px` }}
          dangerouslySetInnerHTML={{ __html: PLACARDS[slotName] }}
        />,
        document.body
      )}
    </ModuleInstanceContext.Provider>
  );
}
