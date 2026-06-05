// Step Sequencer — build a 4-step melody machine from primitives.
//
// Rather than hand the visitor a black-box sequencer, this journey assembles
// one from the parts that make it work: a voice you play by hand, a binary
// counter you advance with a button, a multiplexer the counter addresses, four
// voltage knobs (one per step), then a clock to run it all automatically and a
// quantizer to keep it in tune.
//
// Final patch layout (after all chapters). Columns A–F left→right, rows by y.
// The offsets/mux/counter/triggers are short control tiles, so the left and
// bottom of the patch pack tightly; only the 420px audio row (osc/amp/output)
// and the envelope below the amp need real vertical room. The counter→mux
// address still runs straight up an empty column B lane.
//
//        A(0)        B(380)       C(760)        D(1140)   E(1520)    F(1900)
//  y0    off1                     quantizer     osc       amp        output
//  y230  off2        mux
//  y460  off3                                             ad-env (y480)
//  y690  off4        counter      clock / (trigger)
//  y940              reset
//
// Signal flow: off1..4 → mux.in1..4; counter.bit0/bit1 → mux.a0/a1;
// mux.out → quantizer → osc.pitch; osc → amp → output; ad-env → amp.level;
// clock advances the counter AND fires the envelope (one pulse, two jobs).
//
// Same delta-shape contract as the other journeys: each chapter's `adds`
// applies idempotently when its button is clicked. Module + connection ids are
// stable strings so later deltas can refer back (and tear down) earlier ones.

export default {
  id: "sequencer",
  title: "Step Sequencer",
  objective:
    "Build a 4-step sequencer from scratch — a counter, a multiplexer, four voltage knobs, a clock, and a quantizer — and watch a melody play itself.",
  difficulty: "intermediate",
  estimatedMinutes: 14,

  initialPatch: {
    modules: [
      { id: "osc",     type: "oscillator", params: { type: "sawtooth", freq: 220, octave: 0 }, position: { x: 1140, y: 0    } },
      { id: "amp",     type: "amp",        params: { level: -48 },                              position: { x: 1520, y: 0    } },
      { id: "adenv",   type: "adenv",      params: { a: 0.005, d: 0.28 },                       position: { x: 1520, y: 480  } },
      { id: "advtrig", type: "trigger",    params: { shortcut: "Space" },                       position: { x: 760,  y: 690  } },
      { id: "output",  type: "output",     params: { vol: 80 },                                 position: { x: 1900, y: 0    } },
    ],
    connections: [
      { id: "c-osc-amp", fromId: "osc",     fromPort: "main",   toId: "amp",    toPort: "input" },
      { id: "c-amp-out", fromId: "amp",     fromPort: "output", toId: "output", toPort: "input" },
      { id: "c-env-amp", fromId: "adenv",   fromPort: "env",    toId: "amp",    toPort: "level" },
      // Manual gate fires the envelope. Routed along the bottom then up so it
      // doesn't cut across the oscillator/amp row.
      { id: "c-advtrig-env", fromId: "advtrig", fromPort: "gate", toId: "adenv", toPort: "trigger",
        waypoints: [{ x: 1520, y: 760 }] },
    ],
  },

  chapters: [
    {
      id: "voice",
      kind: "audio",
      ix: "01",
      nm: "The Voice",
      adds: null,
      title: "Every sequence needs something to play.",
      prose: "We start with a complete <b>voice</b>: an oscillator through an amplifier, with an <b>AD envelope</b> that opens the amp for a short pluck each time it's triggered. The <b>Trigger</b> button is your finger on the key — press it to sound one note. Right now the pitch never changes; the rest of this journey is about making it change on its own.",
      tryit: [
        "Press the <b>Trigger</b> (or <b>Space</b>) — one short pluck.",
        "Press it in a steady rhythm — the same note, over and over.",
        "Shorten the envelope's <b>decay</b> for a tighter blip.",
      ],
    },

    {
      id: "counter",
      kind: "control",
      ix: "02",
      nm: "The Counter",
      addLabel: "Add Counter",
      adds: {
        modules: [
          { id: "counter", type: "counter", params: {},                 position: { x: 380, y: 690 } },
          { id: "rsttrig", type: "trigger", params: { shortcut: "KeyR" }, position: { x: 380, y: 970 } },
        ],
        connections: [
          // The SAME trigger now does two jobs: it still fires the envelope,
          // and it also advances the counter by one on every press.
          { id: "c-advtrig-count", fromId: "advtrig", fromPort: "gate", toId: "counter", toPort: "clock" },
          // A second button snaps the count back to zero.
          { id: "c-reset-count",   fromId: "rsttrig", fromPort: "gate", toId: "counter", toPort: "reset" },
        ],
      },
      title: "Counting pulses, in binary.",
      prose: "A <b>counter</b> turns a stream of pulses into a position. Each press now advances it one step — <b>0 → 1 → 2 → 3 → 0</b> — and shows the count two ways: a number, and two lights spelling it in <b>binary</b> (<b>bit 0</b> = ones, <b>bit 1</b> = twos). It isn't touching the sound yet; for now just watch it count. Those two bits are about to become an address.",
      tryit: [
        "Press the <b>Trigger</b> several times — watch <b>00 → 01 → 10 → 11</b>.",
        "Keep going past 3 — it wraps back to 0. Two bits hold exactly four steps.",
        "Press <b>Reset</b> (<b>R</b>) — straight back to 0.",
      ],
    },

    {
      id: "selector",
      kind: "control",
      ix: "03",
      nm: "The Selector",
      addLabel: "Add Multiplexer + Voltages",
      adds: {
        modules: [
          { id: "mux",  type: "multiplexer", params: {},               position: { x: 380, y: 230 } },
          { id: "off1", type: "offset",      params: { value: 0    },   position: { x: 0,   y: 0   } },
          { id: "off2", type: "offset",      params: { value: 0.25 },   position: { x: 0,   y: 230 } },
          { id: "off3", type: "offset",      params: { value: 0.5  },   position: { x: 0,   y: 460 } },
          { id: "off4", type: "offset",      params: { value: 0.75 },   position: { x: 0,   y: 690 } },
        ],
        connections: [
          // Four voltage knobs — one per step — into the four mux inputs.
          { id: "c-off1-mux", fromId: "off1", fromPort: "out", toId: "mux", toPort: "in1" },
          { id: "c-off2-mux", fromId: "off2", fromPort: "out", toId: "mux", toPort: "in2" },
          { id: "c-off3-mux", fromId: "off3", fromPort: "out", toId: "mux", toPort: "in3" },
          { id: "c-off4-mux", fromId: "off4", fromPort: "out", toId: "mux", toPort: "in4" },
          // The counter's two bits become the multiplexer's address.
          { id: "c-bit0-mux", fromId: "counter", fromPort: "bit0", toId: "mux", toPort: "a0" },
          { id: "c-bit1-mux", fromId: "counter", fromPort: "bit1", toId: "mux", toPort: "a1" },
          // The selected voltage drives the oscillator's pitch.
          { id: "c-mux-osc",  fromId: "mux", fromPort: "out", toId: "osc", toPort: "pitch" },
        ],
      },
      title: "Four voltages, one at a time.",
      prose: "A <b>multiplexer</b> is an electronic switch: four inputs, one output, and a 2-bit <b>address</b> that picks which input gets through. We wire the counter's two bits to that address — so the step number now <i>selects</i> a voltage. Each of the four <b>Offset</b> knobs is one step's pitch. Press the Trigger and you step through them by hand: a four-note pattern, played one press at a time.",
      tryit: [
        "Press the <b>Trigger</b> four times — hear the four steps, watch the mux lamp move 1→2→3→4.",
        "Turn <b>Offset 2</b> up and down — only the second note changes.",
        "Set the four knobs to a shape you like — a little melody you can step through.",
        "Hit <b>Reset</b> to jump back to step 1.",
      ],
    },

    {
      id: "clock",
      kind: "control",
      ix: "04",
      nm: "The Clock",
      addLabel: "Add Clock",
      adds: {
        // The clock takes over the manual trigger's job entirely, so the
        // trigger (and both of its wires) is removed.
        removeModules: ["advtrig"],
        modules: [
          { id: "clock", type: "clock", params: { mode: "sync", freq: 2, running: true }, position: { x: 760, y: 690 } },
        ],
        connections: [
          // Counter first so the pitch lands on the new step before the
          // envelope fires — the lamp you see matches the note you hear.
          { id: "c-clk-count", fromId: "clock", fromPort: "x1", toId: "counter", toPort: "clock" },
          { id: "c-clk-env",   fromId: "clock", fromPort: "x1", toId: "adenv",   toPort: "trigger",
            waypoints: [{ x: 1520, y: 760 }] },
        ],
      },
      title: "Let it run itself.",
      prose: "A <b>clock</b> is just an automatic, perfectly regular trigger. We unplug your finger and let the clock pulse instead — every beat it advances the counter <i>and</i> fires the envelope, so the sequence plays on its own. The tempo follows the transport's <b>BPM</b>; the <b>Reset</b> button still restarts the pattern whenever you like.",
      tryit: [
        "Sit back — the four-step pattern loops by itself.",
        "Change the <b>BPM</b> — the whole sequence speeds up and slows down.",
        "Tweak the four <b>Offset</b> knobs while it runs — compose live.",
        "Press <b>Reset</b> on the off-beat — the pattern jumps back to step 1.",
      ],
    },

    {
      id: "quantizer",
      kind: "control",
      ix: "05",
      nm: "In Tune",
      addLabel: "Add Quantizer",
      adds: {
        modules: [
          { id: "quant", type: "quantizer", params: { range: 24, root: 0, scale: "major" }, position: { x: 760, y: 0 } },
        ],
        // Splice the quantizer between the mux and the oscillator's pitch.
        removeConnections: ["c-mux-osc"],
        connections: [
          { id: "c-mux-quant",  fromId: "mux",   fromPort: "out", toId: "quant", toPort: "in"    },
          { id: "c-quant-osc",  fromId: "quant", fromPort: "out", toId: "osc",   toPort: "pitch" },
        ],
      },
      title: "Snap every step to a note.",
      prose: "Tuning four knobs by ear is fiddly — it's easy to land between the notes. A <b>quantizer</b> fixes that: it takes each step's voltage and snaps it to the nearest note of a musical <b>scale</b> before it reaches the oscillator. Now every knob position is in tune, and any pattern sounds musical. Change the <b>root</b> to move the whole sequence into a different key; pick <b>pentatonic</b> and there are no wrong notes at all.",
      tryit: [
        "Sweep an <b>Offset</b> knob — the pitch now jumps cleanly note to note.",
        "Switch the <b>scale</b> to <b>Pentatonic</b> — every combination sounds right.",
        "Step the <b>root</b> up and down — the same pattern, shifted into a new key.",
        "Set all four steps differently and let it run — your sequencer is done.",
      ],
    },
  ],
};
