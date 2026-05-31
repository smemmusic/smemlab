// Drum Sounds — start with a kick (low sine + amp env + pitch env), then
// layer a snare (noise + amp env) with its own trigger so the two voices can
// be triggered independently. Same delta-shape contract as mono-voice.js.
//
// Final patch layout (after all 4 chapters): 5 cols × 3 rows. Kick chain in
// cols A–B, snare chain in cols C–D, output at col E. Rows use a uniform
// 510px gap so adjacent modules don't visually overlap.
//
//          col A 180    col B 545    col C 910    col D 1275   col E 1640
//   y 0   [kick osc]──→[kick amp]──→[snare osc]→[snare amp]─→[output]
//                          ▲                          ▲   ↗
//   y 510 [pitch atv]   [amp env]                 [snare env]
//             ▲             ▲                         ▲
//   y 1020[pitch env]   [kick trig]                [snare trig]
//                          │                          │
//                          └── also fires pitch env   (S key)
//                              (K key)

export default {
  id: "kick",
  title: "Drum Sounds",
  objective: "Build a kick from a sub-bass sine, then layer a noise-based snare on top — two voices with independent triggers, summing into one output.",
  difficulty: "intermediate",
  estimatedMinutes: 12,

  initialPatch: {
    modules: [
      { id: "osc",    type: "oscillator", params: { type: "sine", freq: 50, octave: 0 }, position: { x: 180, y: 0 } },
      { id: "output", type: "output",     params: { vol: 70 },                            position: { x: 910, y: 0 } },
    ],
    connections: [
      { id: "c-osc-out", fromId: "osc", fromPort: "main", toId: "output", toPort: "input" },
    ],
  },

  chapters: [
    {
      id: "source",
      kind: "audio",
      ix: "01",
      nm: "The Sub",
      adds: null,
      title: "A kick begins with a single, very low sine wave.",
      prose: "At <b>50 Hz</b> you're below the range of most melodic notes — close to the fundamental of a real kick drum. On its own it's a continuous rumble; everything we add next will turn that rumble into a punch.",
      tryit: "Listen. Slide the pitch up and back down — anything under ~100 Hz still reads as a kick's body.",
    },

    {
      id: "thump",
      kind: "control",
      ix: "02",
      nm: "Amplitude Envelope",
      addLabel: "Add Amp + Envelope",
      adds: {
        modules: [
          { id: "amp",     type: "amp",     params: { level: 0 },          position: { x: 545, y: 0    } },
          { id: "ampenv",  type: "adenv",   params: { a: 0, d: 0.35 },     position: { x: 545, y: 510  } },
          { id: "trigger", type: "trigger", params: { shortcut: "KeyK" }, position: { x: 545, y: 1020 } },
        ],
        // Splice the amp into the audio chain.
        removeConnections: ["c-osc-out"],
        connections: [
          { id: "c-osc-amp",        fromId: "osc",     fromPort: "main",   toId: "amp",    toPort: "input"   },
          { id: "c-amp-out",        fromId: "amp",     fromPort: "output", toId: "output", toPort: "input"   },
          { id: "c-ampenv-amp",     fromId: "ampenv",  fromPort: "env",    toId: "amp",    toPort: "level"   },
          { id: "c-trig-ampenv",    fromId: "trigger", fromPort: "gate",   toId: "ampenv", toPort: "trigger" },
        ],
        // Drop the amp's intrinsic gain to silence so the AD envelope is the
        // only thing that opens the amp — each gate press becomes a clean
        // thump that fades on its own (AD has no sustain).
        setParams: { amp: { level: -48 } },
      },
      title: "An envelope shapes the rumble into a hit.",
      prose: "We splice an <b>amplifier</b> into the chain and pin its gain to <b>−∞ dB</b> — silent. An <b>AD envelope</b>, triggered by the <b>gate</b>, opens the amp on each press: <b>0 s attack</b> (instant) and <b>350 ms decay</b> back to silence. That envelope shape is the kick's body.",
      tryit: "Press the Trigger (or hit <b>K</b>). Sweep the envelope's decay knob shorter and longer — short = tight kick, long = boomy floor tom.",
    },

    {
      id: "click",
      kind: "control",
      ix: "03",
      nm: "Pitch Click",
      addLabel: "Add Pitch Envelope",
      adds: {
        modules: [
          { id: "pitchatv", type: "attenuverter", params: { amount: 0.24 },       position: { x: 180, y: 510  } },
          { id: "pitchenv", type: "adenv",        params: { a: 0.005, d: 0.175 }, position: { x: 180, y: 1020 } },
        ],
        connections: [
          // Same trigger fires both envelopes — one shot per press. Waypoints
          // route the trigger → pitch-env wire under col A so it doesn't
          // collide with the kick trigger and pitch env on the bottom row.
          { id: "c-trig-pitchenv",   fromId: "trigger",  fromPort: "gate", toId: "pitchenv", toPort: "trigger",
            waypoints: [{ x: 509, y: 985 }, { x: 476, y: 1352 }] },
          // Pitch env → attenuverter → osc.mod (free pitch modulation in ±4 oct range).
          // The attenuverter scales the envelope's 0..1 to a small positive
          // burst — at amount 0.24 that's roughly +1100 cents at the peak,
          // sweeping down to 0 over 175 ms.
          { id: "c-pitchenv-atv",    fromId: "pitchenv", fromPort: "env",  toId: "pitchatv", toPort: "in"      },
          { id: "c-atv-osc-mod",     fromId: "pitchatv", fromPort: "out",  toId: "osc",      toPort: "mod"     },
        ],
      },
      title: "A second envelope adds the click.",
      prose: "A real kick isn't just a thump — there's a fast <b>upward pitch sweep</b> at the start that the ear hears as a percussive click. A second <b>AD envelope</b>, much shorter (<b>175 ms</b>), drives the oscillator's <span class='cy'>pitch mod</span> through an <b>attenuverter</b> that scales it down to a tasteful burst. The same trigger fires both envelopes — one for the body, one for the click.",
      tryit: "Hit the trigger (<b>K</b>). Raise the attenuverter's <b>amount</b> for a more aggressive click, or pull it past centre to invert (downward sweep). Shorten the pitch envelope's decay for tighter snap.",
    },

    {
      id: "snare",
      kind: "audio",
      ix: "04",
      nm: "Snare",
      addLabel: "Add Snare",
      adds: {
        modules: [
          // Snare voice extends the audio chain to the right of the kick.
          // Layout after this chapter (5 cols × 3 rows):
          //   col A (180)  col B (545)  col C (910)  col D (1275)  col E (1640)
          //   kick osc      kick amp     snare osc     snare amp     output
          //   pitch atv     amp env      —             snare env     —
          //   pitch env     kick trig    —             snare trig    —
          { id: "snareOsc",  type: "oscillator", params: { type: "noise", freq: 110, octave: 0 }, position: { x: 910,  y: 0    } },
          { id: "snareAmp",  type: "amp",        params: { level: 0 },                            position: { x: 1275, y: 0    } },
          { id: "snareEnv",  type: "adenv",      params: { a: 0.001, d: 0.15 },                   position: { x: 1275, y: 510  } },
          { id: "snareTrig", type: "trigger",    params: { shortcut: "KeyS" },                    position: { x: 1275, y: 1020 } },
        ],
        connections: [
          // Snare audio path. snareAmp.output sums into output.input alongside
          // the kick's amp.output — WebAudio handles multiple sources to one
          // destination natively, so no mixer module is required here.
          { id: "c-snareOsc-amp",     fromId: "snareOsc",  fromPort: "main",   toId: "snareAmp",  toPort: "input"   },
          { id: "c-snareAmp-out",     fromId: "snareAmp",  fromPort: "output", toId: "output",    toPort: "input"   },
          { id: "c-snareEnv-amp",     fromId: "snareEnv",  fromPort: "env",    toId: "snareAmp",  toPort: "level"   },
          { id: "c-snareTrig-env",    fromId: "snareTrig", fromPort: "gate",   toId: "snareEnv",  toPort: "trigger" },
        ],
        // Slide the output module right so the snare chain (cols C–D) doesn't
        // collide with it. The existing kick amp → output wire just stretches —
        // any over-the-top arch waits until ch5/ch6 where it's actually needed.
        setPositions: { output: { x: 1640, y: 0 } },
        // Same trick as the kick: pin the snare amp to silence so the envelope
        // is the only thing opening it. Each trigger press = one snap.
        setParams: { snareAmp: { level: -48 } },
      },
      title: "A snare is mostly noise.",
      prose: "Where the kick's body is a tuned sine, the snare's body is <b>noise</b> — the metal-on-skin rattle has no pitch. We build the snare with the same recipe (oscillator → silent amp → AD envelope opens it on each gate), but the oscillator is set to <b>noise</b> and the decay is much shorter (<b>150 ms</b>) so the hit is tight and snappy. The new <span class='g'>snare trigger</span> has its own button and its own key — kick is on <b>K</b>, snare is on <b>S</b>, so you can play them independently.",
      tryit: "Tap <b>K S K S</b> for a back-beat, or roll them together for fills. Sweep the snare envelope's decay to taste — shorter for a click, longer for a brushy hiss.",
    },

    {
      id: "hiss",
      kind: "audio",
      ix: "05",
      nm: "Hiss",
      addLabel: "Add High-Pass Filter",
      adds: {
        modules: [
          // Splice a high-pass filter into the snare's noise chain. Sits in
          // col D row 0, between snare osc and the (relocated) snare amp.
          { id: "snareFilter", type: "filter", params: { mode: "highpass", cutoff: 2000, resonance: 1 }, position: { x: 1275, y: 0 } },
        ],
        // Cut the old direct connection and route osc → filter → amp.
        removeConnections: ["c-snareOsc-amp", "c-amp-out"],
        connections: [
          { id: "c-snareOsc-filter", fromId: "snareOsc",    fromPort: "main",   toId: "snareFilter", toPort: "input" },
          { id: "c-snareFilter-amp", fromId: "snareFilter", fromPort: "output", toId: "snareAmp",    toPort: "input" },
          // Re-add the kick-amp → output wire so its arch-over-the-top
          // waypoints carry forward to the new output position. Same shape
          // as the ch4 wire, scaled to the wider span.
          { id: "c-amp-out", fromId: "amp", fromPort: "output", toId: "output", toPort: "input",
            waypoints: [
              { x: 876,  y: -9  },
              { x: 1418, y: -45 },
              { x: 1928, y: -24 },
            ] },
        ],
        // Slide the snare chain + output one column right to make room for
        // the new filter. setPositions makes the moves idempotent — re-running
        // the delta after a Prev → Next round-trip snaps to the same coords.
        setPositions: {
          snareAmp:  { x: 1640, y: 0    },
          snareEnv:  { x: 1640, y: 510  },
          snareTrig: { x: 1640, y: 1020 },
          output:    { x: 2005, y: 0    },
        },
      },
      title: "From rumble to sizzle.",
      prose: "Raw noise has energy at <b>every</b> frequency — including the low ones that overlap the kick and make the snare sound muddy. A <b>high-pass filter</b> set to <b>2 kHz</b> rolls off everything below that, leaving only the bright, hissy sparkle that makes a snare read as a snare. (Real 909 snares use exactly this trick — the noise generator runs through a fixed band-pass that emphasises the upper midrange.)",
      tryit: "Sweep the filter's <b>cutoff</b> down toward 100 Hz — the snare becomes a low whoosh. Push it up to 8 kHz — pure metallic sizzle. Then leave it around 2 kHz where it sounds most like a snare.",
    },

    {
      id: "body",
      kind: "audio",
      ix: "06",
      nm: "Tonal Body",
      addLabel: "Add Tonal Body + Mixer",
      adds: {
        modules: [
          // Tonal voice: a triangle around 200 Hz with a very short envelope
          // — the "thwack" of the drum head, fired by the same snare trigger.
          { id: "tonalOsc",  type: "oscillator", params: { type: "triangle", freq: 200, octave: 0 }, position: { x: 910,  y: 510  } },
          { id: "tonalAmp",  type: "amp",        params: { level: 0 },                                position: { x: 1275, y: 510  } },
          { id: "tonalEnv",  type: "adenv",      params: { a: 0.001, d: 0.08 },                      position: { x: 1275, y: 1020 } },
          // 4-channel mixer replaces the implicit summation at output.input.
          // Now the visitor can balance kick / snare-noise / snare-body
          // explicitly with the three channel gain knobs.
          { id: "mixer",     type: "audiomixer", params: { g1: 0, g2: 0, g3: 0, g4: -60, master: 0 }, position: { x: 2005, y: 0 } },
        ],
        // Tear down the direct amp → output paths so all audio funnels through
        // the mixer instead.
        removeConnections: ["c-amp-out", "c-snareAmp-out"],
        connections: [
          // Tonal voice patching: osc → amp, env opens amp, trigger fires env.
          { id: "c-tonalOsc-amp",   fromId: "tonalOsc",  fromPort: "main",   toId: "tonalAmp", toPort: "input"   },
          { id: "c-tonalEnv-amp",   fromId: "tonalEnv",  fromPort: "env",    toId: "tonalAmp", toPort: "level"   },
          // Same trigger fires the tonal env too. Waypoints route the wire
          // up-and-over so it doesn't cross the snare trigger/env labels.
          { id: "c-snareTrig-tonal", fromId: "snareTrig", fromPort: "gate",  toId: "tonalEnv", toPort: "trigger",
            waypoints: [{ x: 1607, y: 991 }, { x: 1558, y: 1349 }] },
          // Three audio sources into the mixer. The long kick wire routes
          // OVER the top of the row-0 modules (3 waypoints with negative y),
          // and the tonal wire sweeps up from row 1 with a 2-waypoint arc.
          { id: "c-kickamp-mix",  fromId: "amp",       fromPort: "output", toId: "mixer", toPort: "in1",
            waypoints: [
              { x: 876,  y: -9  },
              { x: 1418, y: -45 },
              { x: 1928, y: -24 },
            ] },
          { id: "c-snareamp-mix", fromId: "snareAmp",  fromPort: "output", toId: "mixer", toPort: "in2" },
          { id: "c-tonalamp-mix", fromId: "tonalAmp",  fromPort: "output", toId: "mixer", toPort: "in3",
            waypoints: [
              { x: 1595, y: 509 },
              { x: 1944, y: 434 },
            ] },
          // Mixer master → output.
          { id: "c-mix-out",      fromId: "mixer",     fromPort: "out",    toId: "output", toPort: "input" },
        ],
        // Slide output further right to make room for the mixer at col F.
        // Pin the tonal amp silent so its env is the only thing opening it.
        setPositions: {
          output: { x: 2370, y: 0 },
        },
        setParams: {
          tonalAmp: { level: -48 },
        },
      },
      title: "A snare has pitch too.",
      prose: "Listen carefully to a real snare and you'll hear a brief pitched <b>thwack</b> underneath the hiss — that's the drum's two skins resonating. We add a <b>triangle oscillator at 200 Hz</b> with its own amp and a very short (<b>80 ms</b>) envelope, fired by the same trigger as the noise. With <b>three audio sources</b> now (kick, snare noise, snare body), we route everything through an <b>audio mixer</b> so you can balance them by ear — turn the body up for more thump, the noise up for more sizzle.",
      tryit: "Hit <b>S</b> and tweak the mixer's <b>channel 2</b> (noise) vs <b>channel 3</b> (body) — you can rebalance the snare's character on the fly. Then slide the tonal oscillator's pitch around <b>180–330 Hz</b> to tune the snare.",
    },
  ],
};
