import { useSynthStore } from "../store/useSynthStore.js";
import { ADD_SLOT_COPY } from "../content/addSlotCopy.js";
import { MODULE_META } from "../content/moduleMeta.js";

function nextAddable(blocks) {
  if (!blocks.filter) return "filter";
  if (!blocks.amp)    return "amp";
  if (!blocks.env)    return "env";
  return null;
}

export function AddSlot() {
  const blocks = useSynthStore((s) => s.blocks);
  const addBlock = useSynthStore((s) => s.addBlock);

  const next = nextAddable(blocks);
  if (!next) return null;

  const copy = ADD_SLOT_COPY[next];
  const isControl = MODULE_META[next].kind === "control";

  return (
    <div className="add-slot">
      <button className={"add-btn" + (isControl ? " ctrl" : "")} onClick={() => addBlock(next)}>
        <span className="plus">+</span>
        {copy.title}
        <small>{copy.sub}</small>
      </button>
    </div>
  );
}
