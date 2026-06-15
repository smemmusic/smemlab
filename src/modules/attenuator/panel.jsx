import { Knob } from "../../components/controls/Knob.jsx";
import { useModuleParams } from "../../components/ModuleInstanceContext.js";

function amountReadout(v) {
  if (v < 0.005) return "0";
  return `${Math.round(v * 100)}%`;
}

export function AttenuatorPanel() {
  const [params, setParam] = useModuleParams();

  return (
    <div className="atv-body">
      <div className="atv-axis" aria-hidden="true">
        <span className="atv-end zero">0</span>
        <span className="atv-end pos">+1</span>
      </div>
      <div className="ctrl-grid one">
        <Knob
          label="Amount"
          value={params.amount}
          min={0} max={1} step={0.01}
          unit={amountReadout(params.amount)}
          onChange={(v) => setParam("amount", v)}
        />
      </div>
      <div className="atv-hint">left: silent · right: pass</div>
    </div>
  );
}
