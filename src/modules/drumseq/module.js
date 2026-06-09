import { AudioModule } from "../../audio/AudioModule.js";
import { GateAggregator } from "../../audio/GateAggregator.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";
import { getEngine } from "../../audio/engineSingleton.js";

export const TRACKS = 4;
export const STEPS = 16;
// Port names for the four track gate outputs. Kept as bare digits so the
// per-edge port markers stay narrow even with all four lined up on top.
export const TRACK_OUTPUTS = ["1", "2", "3", "4"];

function emptyPattern() {
  return Array.from({ length: TRACKS }, () => Array(STEPS).fill(false));
}

// 4×16 gate sequencer. The `clock` input advances one step per rising edge;
// the `reset` input snaps the playhead back so the next clock fires step 1.
// Each track has its own gate output that mirrors the incoming clock pulse
// width whenever the current step is active for that track — so the output
// inherits the clock's duty cycle and downstream envelopes see a clean
// open/close per step.
export class DrumSeqModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "clock", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    { name: "reset", dir: PORT_DIR.IN, type: PORT_TYPE.GATE },
    ...TRACK_OUTPUTS.map((n) => ({
      name: n, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE,
    })),
  ];
  static CONTROLS = [];

  constructor(ctx, { pattern } = {}) {
    super(ctx);
    this.pattern = pattern || emptyPattern();
    // -1 means "armed" — next clock advances to step 0. Visible to the panel
    // for the current-step column highlight.
    this.stepIdx = -1;
    this._activeOuts = new Set();   // track names currently held high
    this._clock = new GateAggregator();
    this._reset = new GateAggregator();

    this._registerGateInput("clock", (sid, a) => this._onClock(sid, a));
    this._registerGateInput("reset", (sid, a) => this._onReset(sid, a));
  }

  _onClock(sourceId, active) {
    const { rising, falling } = this._clock.update(sourceId, active);
    if (rising)       this._advance();
    else if (falling) this._closeAll();
  }

  _onReset(sourceId, active) {
    if (this._reset.update(sourceId, active).rising) {
      this.stepIdx = -1;
      this._closeAll();
    }
  }

  _advance() {
    this.stepIdx = (this.stepIdx + 1) % STEPS;
    const engine = getEngine();
    const pat = this.pattern;
    for (let t = 0; t < TRACKS; t++) {
      const row = pat[t];
      if (!row || !row[this.stepIdx]) continue;
      const name = TRACK_OUTPUTS[t];
      engine.emitGate(this.id, name, this.id, true);
      this._activeOuts.add(name);
    }
  }

  _closeAll() {
    if (this._activeOuts.size === 0) return;
    const engine = getEngine();
    for (const name of this._activeOuts) {
      engine.emitGate(this.id, name, this.id, false);
    }
    this._activeOuts.clear();
  }

  setParam(name, value) {
    if (name === "pattern") this.pattern = value;
  }

  dispose() {
    this._closeAll();
    super.dispose();
  }
}
