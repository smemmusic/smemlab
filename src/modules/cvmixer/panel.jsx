import { useSynthStore } from "../../store/useSynthStore.js";
import { Knob } from "../../components/controls/Knob.jsx";
import { useModuleInstance } from "../../components/ModuleInstanceContext.js";

const DEFAULT_PARAMS = {
  g1: 0, g2: 0, g3: 0, g4: 0,
  p1: false, p2: false, p3: false, p4: false,
  master: 0,
};

function ChannelStrip({ idx, dbValue, phaseValue, onDbChange, onPhaseChange }) {
  return (
    <div className="cvmix-strip">
      <Knob
        label={`Ch ${idx}`}
        value={dbValue}
        min={-60}
        max={12}
        step={0.5}
        unit={dbValue <= -60 ? "" : "dB"}
        onChange={onDbChange}
      />
      <button
        type="button"
        className={"cvmix-phase" + (phaseValue ? " on" : "")}
        onClick={() => onPhaseChange(!phaseValue)}
        title={phaseValue ? "Phase reversed (click for normal)" : "Normal phase (click to reverse)"}
      >
        Ø
      </button>
    </div>
  );
}

export function CvMixerPanel() {
  const { instanceId } = useModuleInstance();
  const params = useSynthStore((s) => s.modules.find((m) => m.id === instanceId)?.params) || DEFAULT_PARAMS;
  const setModuleParam = useSynthStore((s) => s.setModuleParam);
  const set = (k, v) => setModuleParam(instanceId, k, v);

  return (
    <div className="cvmix-body">
      <div className="cvmix-row">
        <ChannelStrip
          idx={1}
          dbValue={params.g1} phaseValue={params.p1}
          onDbChange={(v) => set("g1", v)} onPhaseChange={(v) => set("p1", v)}
        />
        <ChannelStrip
          idx={2}
          dbValue={params.g2} phaseValue={params.p2}
          onDbChange={(v) => set("g2", v)} onPhaseChange={(v) => set("p2", v)}
        />
        <ChannelStrip
          idx={3}
          dbValue={params.g3} phaseValue={params.p3}
          onDbChange={(v) => set("g3", v)} onPhaseChange={(v) => set("p3", v)}
        />
        <ChannelStrip
          idx={4}
          dbValue={params.g4} phaseValue={params.p4}
          onDbChange={(v) => set("g4", v)} onPhaseChange={(v) => set("p4", v)}
        />
      </div>
      <div className="cvmix-master">
        <Knob
          label="Master"
          value={params.master}
          min={-60}
          max={12}
          step={0.5}
          unit={params.master <= -60 ? "" : "dB"}
          onChange={(v) => set("master", v)}
        />
      </div>
    </div>
  );
}
