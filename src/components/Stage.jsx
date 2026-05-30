import { useSynthStore } from "../store/useSynthStore.js";
import { LANE_TAGS } from "../content/ui.js";
import { Rack } from "./Rack.jsx";

export function Stage() {
  const hasEnv = useSynthStore((s) => s.blocks.env);
  return (
    <div className="stage">
      <span className="lane-tag audio">{LANE_TAGS.audio}</span>
      {hasEnv && <span className="lane-tag control">{LANE_TAGS.control}</span>}
      <Rack />
    </div>
  );
}
