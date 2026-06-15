import { byId as journeyById } from "../../content/journeys/index.js";
import {
  makeDefaultOutput, buildJourneyGraph, journeyModulePositions, loadGraph,
} from "../graphOps.js";

// Session slice — everything that frames a working session but isn't the patch
// model itself: live UI/interaction state, view preferences, the transport
// (volume, tempo, power), modal flags, and the journey/landing lifecycle
// actions that swap the whole graph in and out.
export const createSessionSlice = (set, get) => ({
  // ===== UI / interaction state =====
  ui: {
    armedSource: null,
    // Live drag-to-patch state. Set while the user is dragging a wire out of an
    // output port; null otherwise. Shape:
    //   { fromId, fromPort, portType, clientX, clientY, hoverId }
    // clientX/clientY track the cursor (viewport coords); hoverId is the
    // "moduleId:portName" of the compatible input currently under the cursor
    // (or null). <Wires> reads this to draw the in-flight wire.
    dragWire: null,
    selectedConnectionId: null,
    focusedModuleSlot: null,
    // Current view scale used by Stage for Module drag scale-correction.
    viewScale: 1,
    // Mobile-only tab: 'synth' shows the rack, 'instructions' shows the narrator.
    mobileView: "synth",
  },

  // ===== Transport / global params + persisted prefs =====
  // Global tempo. Sync-mode clocks derive their rate from this; any future
  // module that needs musical time (sequencer, arpeggiator) reads it from the
  // store directly.
  bpm:     120,
  scope:   { edge: "rising", threshold: 0 },
  // Master visualiser toggle. When false, every Canvas-backed display
  // (oscilloscopes, envelope curves, LFO shapes, gain meters, filter response)
  // skips its analyser reads and rAF loop and renders a static "off"
  // placeholder. Persisted so the visitor's preference survives reload.
  visualsEnabled: true,
  chapter: 0,
  started: false,
  journeyId: null,
  // Puzzle-enabled journeys render as interlocking pieces by default. Flipping
  // this to true drops back to the full modular view (wires, palette, every
  // control + port visible) so an advanced visitor can "go further". Only
  // meaningful while a puzzle journey is active.
  fullModular: false,
  settingsOpen: false,
  patchesOpen: false,

  // ===== Transient (not persisted) =====
  // `playing` is intentionally stored, not a pure selector. The ground truth is
  // the AudioContext's state, but that flips suspended→running asynchronously
  // and isn't React-observable; mirroring it here gives the transport button,
  // panels, and visualisers a synchronous value to render. Transport/Landing
  // keep it ordered with engine.start()/stop().
  playing: false,

  // ---- Free-mode UI actions ----
  armSource:        (moduleId, portName, portType) => set((s) => ({
    ui: { ...s.ui, armedSource: { moduleId, portName, portType } }
  })),
  clearArmedSource: () => set((s) => ({ ui: { ...s.ui, armedSource: null } })),

  // ---- Drag-to-patch ----
  // Begin dragging a wire out of an output. The armed-source machinery still
  // runs in parallel (so compatible inputs glow as candidates), but these
  // actions feed the live preview wire in <Wires>.
  startDragWire: (fromId, fromPort, portType, clientX, clientY) => set((s) => ({
    ui: { ...s.ui, dragWire: { fromId, fromPort, portType, clientX, clientY, hoverId: null, invalid: false } },
  })),
  updateDragWire: (clientX, clientY, hoverId = null, invalid = false) => set((s) => (
    s.ui.dragWire
      ? { ui: { ...s.ui, dragWire: { ...s.ui.dragWire, clientX, clientY, hoverId, invalid } } }
      : {}
  )),
  endDragWire:    () => set((s) => (s.ui.dragWire ? { ui: { ...s.ui, dragWire: null } } : {})),
  selectConnection: (id) => set((s) => ({ ui: { ...s.ui, selectedConnectionId: id } })),
  clearSelection:   () => set((s) => ({ ui: { ...s.ui, selectedConnectionId: null } })),
  focusModule:      (slot) => set((s) => ({ ui: { ...s.ui, focusedModuleSlot: slot } })),
  clearFocus:       () => set((s) => ({ ui: { ...s.ui, focusedModuleSlot: null } })),
  setViewScale:     (viewScale) => set((s) =>
    s.ui.viewScale === viewScale ? {} : { ui: { ...s.ui, viewScale } }
  ),
  setMobileView:    (mobileView) => set((s) =>
    s.ui.mobileView === mobileView ? {} : { ui: { ...s.ui, mobileView } }
  ),

  // ---- Transport / top-level setters ----
  // Master volume lives in the output module's `vol` param (the single source
  // of truth the engine reads). setVol writes it there; the Transport reads it
  // back via the selectVol selector. No mirrored top-level value to keep in sync.
  setVol: (vol) => set((s) => ({
    modules: s.modules.map((m) =>
      m.type === "output" ? { ...m, params: { ...m.params, vol } } : m
    ),
  })),
  setBpm:            (bpm) => set({ bpm: Math.max(20, Math.min(300, Math.round(bpm))) }),
  setVisualsEnabled: (visualsEnabled) => set({ visualsEnabled: !!visualsEnabled }),
  setScopeEdge:      (edge) => set((s) => ({ scope: { ...s.scope, edge } })),
  setScopeThreshold: (threshold) => set((s) => ({ scope: { ...s.scope, threshold } })),
  setSettingsOpen:   (settingsOpen) => set({ settingsOpen }),
  setPatchesOpen:    (patchesOpen) => set({ patchesOpen }),
  setPlaying:        (playing) => set({ playing }),

  // ---- Puzzle ⇄ full modular view ----
  // Toggle a puzzle journey between its interlocking-pieces view and the full
  // modular view. Switching INTO full modular re-spreads the modules to the
  // journey's authored positions (puzzle layout overlaps them); switching back
  // lets Rack's auto-snap re-interlock them.
  setFullModular: (on) => set((s) => {
    const fullModular = !!on;
    if (!fullModular || !s.journeyId) return { fullModular };
    const wanted = journeyModulePositions(journeyById(s.journeyId));
    const modules = s.modules.map((m) =>
      wanted[m.id] ? { ...m, position: { ...wanted[m.id] } } : m
    );
    return { fullModular, modules };
  }),

  // ---- Chapters ----
  goChapter:   (i) => set({ chapter: i }),
  nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),

  // ---- Landing / Journey selection ----
  setStarted: (started) => set({ started }),

  // Pick a journey from the landing picker. Builds the journey's graph at
  // chapter 0 (its initialPatch) so each journey can begin from an arbitrary
  // patch shape, not just osc→output.
  startJourney: (id) => {
    const journey = journeyById(id);
    set({
      ...loadGraph(buildJourneyGraph(journey, 0), { mobileView: "instructions" }),
      journeyId: id,
      started: true,
    });
  },

  // Open free build — empty rack with the mandatory Output seeded on the right
  // of the canvas; palette visible. No journey, so no narrator sidebar; the
  // user patches from scratch.
  enterFreeBuild: () => set({
    ...loadGraph({ modules: [makeDefaultOutput()], connections: [] }, { mobileView: "synth" }),
    journeyId: null,
    started: true,
  }),

  // Return to the journey picker. Full reset to the empty landing state — no
  // Output is seeded here (merge only seeds one once `started`), so the rack
  // stays empty behind the picker.
  backToJourneys: () => set((s) => ({
    modules: [], connections: [],
    ui: { ...s.ui, armedSource: null, dragWire: null, selectedConnectionId: null, focusedModuleSlot: null, viewScale: 1, mobileView: "synth" },
    chapter: 0,
    journeyId: null,
    fullModular: false,
    started: false,
    playing: false,
  })),

  // "Start again" — re-runs the current journey from chapter 0. In free build,
  // clears the rack back to a fresh Output. Keeps the visitor's current view
  // (zoom + mobile tab) rather than snapping it back.
  resetSession: () => set((s) => {
    const graph = s.journeyId
      ? buildJourneyGraph(journeyById(s.journeyId), 0)
      : { modules: [makeDefaultOutput()], connections: [] };
    return loadGraph(graph, { ui: s.ui, fresh: false });
  }),
});
