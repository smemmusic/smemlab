import { Oscilloscope } from "../../components/viz/Oscilloscope.jsx";
import { OUTPUT_TO_SPEAKER } from "../../content/ui.js";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";
import { CANONICAL_IDS } from "../../store/graphBuilder.js";

export function OutputPanel() {
  const { instanceId } = useModuleInstance();
  const id = instanceId || CANONICAL_IDS.output;
  return (
    <>
      <Oscilloscope tag="Oscilloscope · final signal" instanceId={id} />
      <div className="spk">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16 8c1.5 1.5 1.5 6.5 0 8" />
          <path d="M19 5c3 3 3 11 0 14" />
        </svg>
        <span>{OUTPUT_TO_SPEAKER}</span>
      </div>
    </>
  );
}
