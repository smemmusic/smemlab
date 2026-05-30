// Abstract base class for an audio module.
// Subclasses must implement `input` and `output` getters returning AudioNodes,
// and override `dispose()` to stop/disconnect their owned nodes.

export class AudioModule {
  constructor(ctx) {
    this.ctx = ctx;
  }
  get input()  { throw new Error("AudioModule subclass must implement `input` getter"); }
  get output() { throw new Error("AudioModule subclass must implement `output` getter"); }
  dispose()    {}
}
