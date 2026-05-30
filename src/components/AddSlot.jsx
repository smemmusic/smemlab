import { useSynthStore } from "../store/useSynthStore.js";
import { ADD_SLOT_COPY } from "../content/addSlotCopy.js";
import { MODULE_META } from "../content/moduleMeta.js";

function nextAddable(blocks) {
  if (!blocks.filter) return "filter";
  if (!blocks.amp)    return "amp";
  if (!blocks.env)    return "env";
  if (!blocks.lfo)    return "lfo";
  return null;
}

// Empty rack "bay" — the dashed rail-style slot inviting the next add.
export function AddSlot() {
  const blocks = useSynthStore((s) => s.blocks);
  const addBlock = useSynthStore((s) => s.addBlock);

  const next = nextAddable(blocks);
  if (!next) return null;

  const copy = ADD_SLOT_COPY[next];
  const isControl = MODULE_META[next].kind === "control";

  function add() {
    addBlock(next);
    requestAnimationFrame(() => {
      document.querySelector(".stage")?.scrollTo({ left: 99999, behavior: "smooth" });
    });
  }

  return (
    <div className={"bay" + (isControl ? " control" : "")} onClick={add}>
      <span className="rail-screw t1" />
      <span className="rail-screw t2" />
      <span className="rail-screw b1" />
      <span className="rail-screw b2" />
      <span className="plus">+</span>
      <span className="bt">{copy.title}</span>
      <small>{copy.sub}</small>
    </div>
  );
}
