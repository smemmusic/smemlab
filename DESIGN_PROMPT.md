# Design brief — SMEM Lab

Copy everything below this line into Claude (alongside `index.html` and `MODULES.md`) when asking for design help.

---

## Context

I'm building an **educative synthesiser experience** for **SMEM** ([smemmusic.ch](https://www.smemmusic.ch)) — a Swiss museum and library dedicated to electronic music, instruments, and synth culture. This web app sits alongside SMEM's mission of making electronic-music heritage understandable to a general public, not just to engineers or musicians.

The single attached file `index.html` is the working prototype. It runs end-to-end: real Web Audio, real visualisers, real signal flow. Look at it before suggesting changes.

## What the app teaches

The user **builds a subtractive synth one module at a time** and hears/sees what each block does. The pedagogy is non-negotiable:

1. **Signal flows left-to-right** through modular blocks connected by cables. This visual *is* the lesson.
2. **Audio path vs. control path** is the central distinction. Audio is what you hear; control reshapes audio but is silent on its own. They use the same kind of wire — only the role differs.
3. **Gain is in decibels, and dB *add***. The amplifier is an offset, not a multiplier; the envelope is an offset that sums onto it. The meter visualises this sum directly.
4. **Incremental reveal**: start with only an oscillator + speaker, then unlock Filter, Amp, Envelope, etc. A narrator panel at the top explains the current step in plain language.

## Current visual language (keep this DNA)

- Dark panel / eurorack-inspired modules with faux screws at the corners.
- **Amber** (`#ffb454`) = audio. **Cyan** (`#4fd6ff`) = control. This pairing is load-bearing — never break it.
- CRT-style "screens" inside each module (scanlines, glow) for scopes/meters.
- Typography: Chakra Petch for UI, Spectral italic for narrator/placard prose.
- Animated dashed flow inside the cables when audio is running.

## What I need from you

Look at `index.html` and `MODULES.md` and help me with the next design moves. Specifically:

1. **Round out the module set.** `MODULES.md` lists what still needs to be designed: noise oscillator shape, high-pass filter, mixer (audio + control), LFO, attenuator, attenuverter, inverter, gate, keyboard, keyboard tracking. Each needs (a) the same visual grammar as the current modules, (b) a small inline visualiser that makes its behaviour legible, (c) a one-paragraph placard in the existing tone.
2. **Narrator progression.** As the module set grows, the current 4-step narrator won't scale. Propose a structure for the educative arc — chapters? a side rail? — that doesn't drown the user.
3. **Mobile / small screens.** The current horizontal rack scrolls but is cramped on phone. Propose a responsive approach that preserves the left-to-right signal-flow metaphor.
4. **Landing / onboarding.** Right now the app drops you into Step 1 with no framing. What's the lightest possible intro that sets SMEM's voice without slowing the user down?
5. **Polish pass.** Anything in the current prototype that reads as "engineer-made" rather than "museum-quality". Flag it.

## Constraints

- Single-file HTML stays the target (no build step, no framework). Inline CSS and JS only.
- Must run on a kiosk in a museum *and* on a phone at home.
- No emoji. No marketing copy. The voice is curious and precise — closer to a good museum label than to a SaaS landing page.
- Audio-vs-control colour coding is sacred. Don't propose a third semantic colour without an extremely good reason.

Please respond with a written design direction first (no code), then we'll iterate.
