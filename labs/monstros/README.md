# Monstros

An original fictional arcade vehicle duel, made for the Cartel Kit presentation. The vehicles, arena, pulse effects, shield values and movement rules are invented. They are **not** models of real vehicles, weapons, armor, tactics, organizations or geographic locations. The demo does not support the separate Cartel Kit research findings.

## Run and inspect

Serve this directory through a static web server, or use the published portfolio lab. No dependencies, API keys, network requests or external services are used by the engine or app. The page links to other portfolio material only when a visitor follows a link.

From the repository root:

```text
node labs/monstros/tests.mjs
```

The browser begins paused. Select a pairing and integer seed, then Run, Pause, Step, or Reset. Focus the arena for keyboard controls: Space toggles playback, Right Arrow advances one tick while paused, and R resets. Reduced-motion preferences keep the initial scene still and pause an active match if that preference changes. Hiding the page also pauses playback.

The `?embed=1` view is the compact version used on the Cartel Kit page. It uses the same engine and controls.

## Rules and evidence boundary

- Simulation time advances at 30 fixed steps per second. Playback speed affects the clock-to-tick schedule, never the step calculations.
- Two fictional units move around geometric cover and emit abstract arcade pulses. A pulse that meets cover disappears; a pulse that meets the other vehicle subtracts invented shield points.
- The seed drives one documented 32-bit linear congruential generator. Movement order, event order, rounding in the exported summary, and the arcade constants are fixed in `model.mjs`.
- A match ends when a shield reaches zero or at 2,400 ticks (80 simulated seconds). At the time limit, the greater proportion of initial shield remaining wins. Equal proportions draw.
- This is an intentionally small simulation. Movement and collision checks use discrete ticks, not continuous physical dynamics. The units are arbitrary game coordinates. There is no physical calibration or real-world inference.
- Pulses are capped at 40 and the event ledger at 400 entries. Exported values contain setup, bounded events and a deterministic result rather than executable code.

## Replay verification

Export is available at tick zero, during a match, and after completion. A replay records the exact seed, pairing, tick count, terminal summary and bounded event ledger. The browser import accepts JSON up to 256 KiB. `replayRecord()` reconstructs the match from the setup and compares both the summary and the event history. Changed outcomes, changed event text, unsupported engine versions, and excess tick counts are rejected.

This establishes consistency with this engine, not authenticity or a digital signature. An author can construct a new valid replay by running the public rules. Keep the engine version with the replay; future rule changes require a new version.

## Source

`model.mjs` contains the pure fixed-step transition and replay verifier. `app.mjs` handles the original Canvas vector artwork, controls, textual status and downloads. `tests.mjs` exercises determinism, bounded completion, reset behavior, input gates, partial replay, tamper rejection and output ownership. No external media is embedded.

The visual treatment uses fictional industrial silhouettes and abstract pulse effects. Cartel Kit's published-source model audit remains a separate, attributed research artifact.
