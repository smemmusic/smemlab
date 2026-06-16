import { WorkletModule } from "../../audio/WorkletModule.js";
import {
  MODULE_KIND, PORT_TYPE, PORT_DIR, CV_POLARITY,
  CONTROL_KIND, CONTROL_CURVE,
} from "../../audio/graph/types.js";
import { useSynthStore } from "../../store/useSynthStore.js";

// Pulse generator. Seven gate outputs emit at fixed divisions / multiplications
// of a base rate, all phase-locked at counter == 0 so two clocks at /4 and x2
// line up on the bar. Everything — tick scheduling, the divided fan-out, and
// the pulse width — runs in the AudioWorkletProcessor, so the gate signals are
// sample-accurate and never touch the main thread. Sync mode derives the base
// rate from the store's global `bpm` (quarter-note = bpm/60 Hz); free mode uses
// the `freq` knob (Hz). The base is written into the `freq` AudioParam from the
// main thread (a param write, not a realtime signal); a CV input sums into it.
export const CLOCK_OUTPUTS = [
  { name: "/8", factor: 1 / 8 },
  { name: "/4", factor: 1 / 4 },
  { name: "/2", factor: 1 / 2 },
  { name: "x1", factor: 1     },
  { name: "x2", factor: 2     },
  { name: "x4", factor: 4     },
  { name: "x8", factor: 8     },
];

const BASE_FACTOR = 8;            // worklet ticks at base × this (the x8 rate)
const COUNTER_MOD = 64;
// Base ticks between pulses for each output, in CLOCK_OUTPUTS order.
const TICKS = CLOCK_OUTPUTS.map((o) => BASE_FACTOR / o.factor);
const X1_INDEX = CLOCK_OUTPUTS.findIndex((o) => o.name === "x1");

// AudioWorklet processor. Runs on the audio thread: tracks a fractional sample
// accumulator, fires a base tick every `sampleRate / (freq*BASE_FACTOR)`
// samples, and on each tick raises every output whose tick-divisor lands on the
// current count. Each raised output holds high for a pulse width (half its
// period, clamped 5–80 ms) counted down per sample. Posts a beat snapshot on
// each x1 rising edge for the panel LED. Constants are injected at build.
const WORKLET_CODE = `
const TICKS = [${TICKS.join(",")}];
const N = ${CLOCK_OUTPUTS.length};
const BASE_FACTOR = ${BASE_FACTOR};
const COUNTER_MOD = ${COUNTER_MOD};
const X1 = ${X1_INDEX};
class ClockProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'freq', defaultValue: 2, minValue: 0, maxValue: 400, automationRate: 'a-rate' }];
  }
  constructor() {
    super();
    this._acc = 0;          // samples since last base tick
    this._tick = 0;         // base-tick counter (mod COUNTER_MOD)
    this._first = true;     // fire the first tick immediately (downbeat)
    this._high = new Float32Array(N);  // remaining high samples per output
    this._running = true;
    this._beat = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.t === 'param' && d.name === 'running') {
        const r = !!d.value;
        if (!this._running && r) { this._acc = 0; this._tick = 0; this._first = true; }
        this._running = r;
      }
    };
  }
  process(inputs, outputs, parameters) {
    const blockLen = outputs[0][0].length;
    const farr = parameters.freq;
    if (!this._running) {
      for (let k = 0; k < N; k++) outputs[k][0].fill(0);
      return true;
    }
    for (let i = 0; i < blockLen; i++) {
      const f = Math.max(0.01, farr.length > 1 ? farr[i] : farr[0]);
      const spt = sampleRate / (f * BASE_FACTOR);
      if (this._first || this._acc >= spt) {
        if (this._acc >= spt) this._acc -= spt;
        this._first = false;
        for (let k = 0; k < N; k++) {
          if (this._tick % TICKS[k] === 0) {
            let pulse = (spt * TICKS[k]) * 0.5;
            const minS = 0.005 * sampleRate, maxS = 0.080 * sampleRate;
            if (pulse < minS) pulse = minS; else if (pulse > maxS) pulse = maxS;
            this._high[k] = pulse;
            if (k === X1) { this._beat++; this.port.postMessage({ t: 'state', s: { beat: this._beat } }); }
          }
        }
        this._tick = (this._tick + 1) % COUNTER_MOD;
      }
      for (let k = 0; k < N; k++) {
        if (this._high[k] > 0) { outputs[k][0][i] = 1; this._high[k] -= 1; }
        else                   { outputs[k][0][i] = 0; }
      }
      this._acc += 1;
    }
    return true;
  }
}
registerProcessor('clock-processor', ClockProcessor);
`;

export class ClockModule extends WorkletModule {
  static KIND = MODULE_KIND.CONTROL;
  static PROCESSOR = "clock-processor";
  static PROCESSOR_CODE = WORKLET_CODE;
  static PORTS = CLOCK_OUTPUTS.map((o) => ({
    name: o.name, dir: PORT_DIR.OUT, type: PORT_TYPE.GATE,
  }));
  static CONTROLS = [
    { name: "freq", kind: CONTROL_KIND.KNOB, range: [0.1, 20], curve: CONTROL_CURVE.EXP,
      cvRange: 10, cvPolarity: CV_POLARITY.BIPOLAR },
  ];

  constructor(ctx, { mode = "sync", freq = 2, running = true } = {}) {
    super(ctx, { freq });
    this.mode = mode;
    this.freqKnob = freq;
    this.running = running;
    this._postParam("running", running);
    // Mirror global BPM into the base-rate param while in sync mode.
    this._unsubBpm = useSynthStore.subscribe((s) => s.bpm, () => this._pushBase());
    this._pushBase();
  }

  // Compute the base (x1) rate and write it into the worklet's `freq` param. A
  // wired CV input sums on top of this on the audio thread.
  _pushBase() {
    const bpm = useSynthStore.getState().bpm || 120;
    const base = this.mode === "sync" ? bpm / 60 : this.freqKnob;
    const p = this.node.parameters.get("freq");
    if (p) p.setValueAtTime(base, this.ctx.currentTime);
  }

  setParam(name, value) {
    if (name === "freq")         { this.freqKnob = value; this._pushBase(); }
    else if (name === "mode")    { this.mode = value; this._pushBase(); }
    else if (name === "running") { this.running = value; this._postParam("running", value); }
  }

  // Incrementing beat counter (snapshot), bumped on each x1 rising edge — the
  // panel blinks its LED when this changes.
  getBeat() { return this._state.beat ?? 0; }

  dispose() {
    if (this._unsubBpm) { try { this._unsubBpm(); } catch {} this._unsubBpm = null; }
    super.dispose();
  }
}
