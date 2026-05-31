import { AudioModule } from "../../audio/AudioModule.js";
import { MODULE_KIND, PORT_TYPE, PORT_DIR } from "../../audio/graph/types.js";

// Pure control module: emits a gate signal when the user presses the panel
// button (or the assigned keyboard shortcut). Gate is event-based, dispatched
// by the engine's _gateConnections map. The panel calls engine.emitGate(...)
// directly; the module itself holds no Web Audio nodes.
export class TriggerModule extends AudioModule {
  static KIND = MODULE_KIND.CONTROL;
  static PORTS = [
    { name: "gate", dir: PORT_DIR.OUT, type: PORT_TYPE.GATE },
  ];
  static CONTROLS = [];

  constructor(ctx) { super(ctx); }
  setParam() {}
}
