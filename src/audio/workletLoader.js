// Registers AudioWorklet processor sources on an AudioContext — once each.
//
// Worklet-backed control modules (clock, envelopes, counters, drum-seq, mux,
// quantizer) declare `static PROCESSOR` (the registered name) and
// `static PROCESSOR_CODE` (the processor source string). The engine collects
// every distinct processor from the module registry and registers them all
// right after it creates the AudioContext, BEFORE any module is built, so a
// WorkletModule constructor can create its AudioWorkletNode synchronously.
//
// Registration is async (`audioWorklet.addModule` returns a promise); the engine
// exposes the returned promise via `whenReady()` and the bridge awaits it before
// its first reconcile.

const _ready = new WeakMap(); // ctx -> Promise<void>

// processors: Array<{ name, code }>. Deduped by name (the envelope / counter /
// mux families each share one processor across their variants). Idempotent per
// context: repeated calls return the same promise.
export function registerWorkletProcessors(ctx, processors) {
  let p = _ready.get(ctx);
  if (p) return p;

  const seen = new Set();
  const unique = [];
  for (const proc of processors) {
    if (!proc || !proc.name || !proc.code || seen.has(proc.name)) continue;
    seen.add(proc.name);
    unique.push(proc);
  }

  p = Promise.all(unique.map(({ code }) => {
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    return ctx.audioWorklet
      .addModule(url)
      .finally(() => { try { URL.revokeObjectURL(url); } catch {} });
  })).then(() => {});

  _ready.set(ctx, p);
  return p;
}

export function workletsReady(ctx) {
  return _ready.get(ctx) || Promise.resolve();
}
