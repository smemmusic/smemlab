import { AudioModule } from "./AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../graph/types.js";

// Pure control module: emits a gate signal when the user presses the panel
// button (or spacebar on the canonical instance). Each free-mode instance
// has its own gate output port, independently routable to any gate input
// (typically env.trigger).
//
// The module itself holds no Web Audio nodes — gate is event-based, dispatched
// by the engine's _gateConnections map. The panel calls `emit(active)` which
// goes through the facade → graph.emitGate → destination.onGate.
export class GateModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "gate", dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
  ];
  static CONTROLS = [];

  constructor(ctx) {
    super(ctx);
    // No nodes to manage. The engine's gate routing table handles dispatch.
    this._lastActive = false;
  }

  setParam() { /* no params */ }
}
