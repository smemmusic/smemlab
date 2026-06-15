import { AudioModule } from "../../audio/AudioModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";
import { useSynthStore } from "../../store/useSynthStore.js";

// Each output port emits a gate at the base rate scaled by `factor`. The
// AudioWorklet runs at the fastest output's rate (x8) and posts a message per
// base tick; the main thread counts ticks and fans rising edges out to the
// slower outputs, so every output shares rising-edge phase and the divisions
// line up musically across the row.
export const CLOCK_OUTPUTS = [
  { name: "/8", factor: 1 / 8 },
  { name: "/4", factor: 1 / 4 },
  { name: "/2", factor: 1 / 2 },
  { name: "x1", factor: 1     },
  { name: "x2", factor: 2     },
  { name: "x4", factor: 4     },
  { name: "x8", factor: 8     },
];

const BASE_FACTOR = 8;
const COUNTER_MOD = 64;
const TICKS_PER_PULSE = Object.freeze(
  Object.fromEntries(CLOCK_OUTPUTS.map((o) => [o.name, BASE_FACTOR / o.factor]))
);

// AudioWorklet processor source. Runs on the audio rendering thread so tick
// timing is unaffected by main-thread work (knob drags, React re-renders, the
// bridge's reconcile loop). The processor schedules each base tick at an
// absolute sample index and posts a message per tick; even if the main thread
// is briefly blocked, messages queue up and fire at the right rate on average.
const WORKLET_CODE = `
class ClockProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'baseHz', defaultValue: 2, minValue: 0.01, maxValue: 200, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    // -1 = first process() call will anchor the schedule at the current frame
    // so the first tick fires immediately rather than after a full period.
    this._nextSample = -1;
  }
  process(inputs, outputs, params) {
    const baseHz = Math.max(0.01, params.baseHz[0]);
    const samplesPerTick = sampleRate / (baseHz * ${BASE_FACTOR});
    const blockStart = currentFrame;
    const blockEnd = blockStart + 128;
    if (this._nextSample < blockStart) this._nextSample = blockStart;
    while (this._nextSample < blockEnd) {
      this.port.postMessage(0);
      this._nextSample += samplesPerTick;
    }
    return true;
  }
}
registerProcessor('clock-processor', ClockProcessor);
`;

// One addModule per AudioContext. The same blob URL is reused so addModule
// stays idempotent across multiple ClockModule instances on the same ctx.
const _workletReady = new WeakMap();
function ensureWorklet(ctx) {
  let p = _workletReady.get(ctx);
  if (!p) {
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    p = ctx.audioWorklet.addModule(url);
    _workletReady.set(ctx, p);
  }
  return p;
}

// Pulse generator. Sync mode derives the base rate from the store's global
// `bpm` (quarter-note = bpm/60 Hz); free mode uses the `freq` knob (Hz).
// Seven outputs emit at fixed divisions / multiplications of that base, all
// phase-locked at counter == 0 so a downstream patch can run two clocks at
// /4 and x2 and hear them line up on the bar.
export class ClockModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = CLOCK_OUTPUTS.map((o) => ({
    name: o.name, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE,
  }));
  static CONTROLS = [
    { name: "freq", kind: CONTROL_KIND.KNOB, range: [0.1, 20], curve: CONTROL_CURVE.EXP,
      cvRange: 10, cvPolarity: CV_POLARITY.BIPOLAR },
  ];

  constructor(ctx, { mode = "sync", freq = 2, running = true } = {}) {
    super(ctx);
    this.mode = mode;
    this.freq = freq;
    this.running = running;
    this._counter = 0;
    this._node = null;
    this._sink = null;
    this._unsubBpm = null;
    this._releaseTimers = [];
    // performance.now() of the last x1 rising edge — read by the panel to
    // blink its LED in time with the displayed bpm.
    this.lastBeatAt = 0;

    // CV input scaler is created here so wiring is possible before the worklet
    // node exists; start() connects the scaler to the worklet's baseHz param.
    this._makeCvInput("freq", 10, null);
  }

  async start() {
    if (this._node) return;
    await ensureWorklet(this.ctx);
    const node = new AudioWorkletNode(this.ctx, "clock-processor");
    this._node = node;

    // Worklet nodes only run while in the graph. Route through a zero-gain
    // sink to keep it processing without contributing to the audio output.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    node.connect(sink).connect(this.ctx.destination);
    this._sink = sink;

    // Sample-accurate CV modulation: route the freq CV scaler directly into
    // the worklet param so it sums with the knob value on the audio thread.
    const baseHzParam = node.parameters.get("baseHz");
    const cv = this._cvPorts.in.freq;
    cv.scaler.connect(baseHzParam);
    cv.target = baseHzParam;

    this._pushBaseHz();

    // Mirror global BPM into the worklet param while in sync mode.
    this._unsubBpm = useSynthStore.subscribe(
      (s) => s.bpm,
      () => this._pushBaseHz()
    );

    node.port.onmessage = () => this._onTick();
  }

  _pushBaseHz() {
    if (!this._node) return;
    const bpm = useSynthStore.getState().bpm || 120;
    const base = this.mode === "sync" ? bpm / 60 : this.freq;
    this._node.parameters.get("baseHz").setTargetAtTime(
      base, this.ctx.currentTime, 0.005
    );
  }

  _onTick() {
    if (!this.running) return;
    // Estimate the current tick spacing for pulse-width scaling. Off by the
    // CV contribution but only used to size the gate-low timeout, not the
    // rising edge — close enough.
    const bpm = useSynthStore.getState().bpm || 120;
    const base = this.mode === "sync" ? bpm / 60 : this.freq;
    const baseTickMs = 1000 / Math.max(0.08, base * BASE_FACTOR);

    for (const out of CLOCK_OUTPUTS) {
      const ticks = TICKS_PER_PULSE[out.name];
      if (this._counter % ticks !== 0) continue;
      const periodMs = baseTickMs * ticks;
      const pulseMs = Math.max(5, Math.min(80, periodMs * 0.5));
      if (out.name === "x1") this.lastBeatAt = performance.now();
      this.emitGate(out.name, true);
      // Schedule the falling edge and track the timer so dispose() can cancel
      // it. The timer removes itself from the list when it fires, so the list
      // only ever holds genuinely-pending releases (no unbounded growth, and no
      // dropped-without-clearing references that could leave a gate stuck high).
      const t = setTimeout(() => {
        this.emitGate(out.name, false);
        const i = this._releaseTimers.indexOf(t);
        if (i !== -1) this._releaseTimers.splice(i, 1);
      }, pulseMs);
      this._releaseTimers.push(t);
    }
    this._counter = (this._counter + 1) % COUNTER_MOD;
  }

  setParam(name, value) {
    if (name === "freq")      { this.freq = value; this._pushBaseHz(); }
    else if (name === "mode") { this.mode = value; this._pushBaseHz(); }
    else if (name === "running") {
      // Going stopped → running resets the phase so the first tick after
      // restart is a downbeat (counter == 0 fires every output together).
      if (!this.running && value) this._counter = 0;
      this.running = value;
      if (!value) {
        // Close any output that might currently be high so a downstream
        // envelope doesn't sustain forever while the clock is stopped.
        for (const out of CLOCK_OUTPUTS) this.emitGate(out.name, false);
      }
    }
  }

  dispose() {
    if (this._unsubBpm) { try { this._unsubBpm(); } catch {} this._unsubBpm = null; }
    for (const t of this._releaseTimers) clearTimeout(t);
    this._releaseTimers.length = 0;
    if (this._node) {
      try { this._node.port.onmessage = null; } catch {}
      try { this._node.disconnect(); } catch {}
      this._node = null;
    }
    if (this._sink) {
      try { this._sink.disconnect(); } catch {}
      this._sink = null;
    }
    // Close every gate so envelopes downstream don't latch high after delete.
    for (const out of CLOCK_OUTPUTS) this.emitGate(out.name, false);
    super.dispose();
  }
}
