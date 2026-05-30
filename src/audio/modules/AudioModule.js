import { MODULE_KIND } from "../graph/types.js";

// Abstract base class for an audio module.
// Subclasses must implement `input` and `output` getters returning AudioNodes,
// and override `dispose()` to stop/disconnect their owned nodes.
//
// Typed-port metadata (read by the new graph engine, ignored by the legacy path):
//   static KIND     — MODULE_KIND.AUDIO | MODULE_KIND.CONTROL
//   static PORTS    — explicit audio/gate/CV-output port declarations using
//                     PORT_TYPE / PORT_DIR / CV_POLARITY enums
//   static CONTROLS — knobs/switches using CONTROL_KIND / CONTROL_CURVE /
//                     CV_POLARITY enums. The base auto-generates a CV input
//                     port per control with a destination-owned scaler (cvRange).
// Until the new engine is wired in, these are passive metadata.

export class AudioModule {
  static KIND = MODULE_KIND.AUDIO;
  static PORTS = [];
  static CONTROLS = [];

  constructor(ctx) {
    this.ctx = ctx;
  }
  get input()  { throw new Error("AudioModule subclass must implement `input` getter"); }
  get output() { throw new Error("AudioModule subclass must implement `output` getter"); }
  dispose()    {}
}
