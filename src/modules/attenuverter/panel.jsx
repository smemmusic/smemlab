import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = { amount: 0 };

function amountReadout(v) {
  if (Math.abs(v) < 0.005) return "0";
  const sign = v < 0 ? "−" : "+";
  return `${sign}${Math.round(Math.abs(v) * 100)}%`;
}

export function AttenuverterPanel() {
  const { instanceId } = useModuleInstance();
  const params = useSynthStore((s) => s.modules.find((m) => m.id === instanceId)?.params) || DEFAULT_PARAMS;
  const setModuleParam = useSynthStore((s) => s.setModuleParam);

  return (
    <div className="atv-body">
      <div className="atv-axis" aria-hidden="true">
        <span className="atv-end neg">−1</span>
        <span className="atv-end zero">0</span>
        <span className="atv-end pos">+1</span>
      </div>
      <div className="ctrl-grid one">
        <Knob
          label="Amount"
          value={params.amount}
          min={-1} max={1} step={0.01}
          unit={amountReadout(params.amount)}
          onChange={(v) => setModuleParam(instanceId, "amount", v)}
        />
      </div>
      <div className="atv-hint">left: invert · centre: off · right: pass</div>
    </div>
  );
}
