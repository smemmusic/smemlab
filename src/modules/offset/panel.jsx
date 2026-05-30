import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = { value: 0 };

function valueReadout(v) {
  if (v < 0.005) return "0";
  return `+${Math.round(v * 100)}%`;
}

export function OffsetPanel() {
  const { instanceId } = useModuleInstance();
  const params = useSynthStore((s) => s.modules.find((m) => m.id === instanceId)?.params) || DEFAULT_PARAMS;
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  return (
    <div className="atv-body">
      <div className="atv-axis" aria-hidden="true">
        <span className="atv-end zero">0</span>
        <span className="atv-end pos">+1</span>
      </div>
      <div className="ctrl-grid one">
        <Knob
          label="Value"
          value={params.value}
          min={0} max={1} step={0.01}
          unit={valueReadout(params.value)}
          onChange={(v) => setModuleParam(instanceId, "value", v)}
        />
      </div>
      <div className="atv-hint">constant cv · 0 → +1</div>
    </div>
  );
}
