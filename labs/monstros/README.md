# Monstros

A Cartel Kit vehicle study combining a licensed historical photograph, attributed source records, and a real-time WebGL 2 scene. Three original truck meshes interpret the visible body proportions, enclosed plating, wheels, and roof fixtures in the references. They are authored visual studies, not measured reconstructions or photogrammetry. Movement, damage, and outcomes remain game abstractions; the historical archive does not calibrate the engine.

## Run and inspect

Serve this directory through a static web server, or use the published portfolio lab. The browser requires WebGL 2. Three.js 0.186.1 and OrbitControls are pinned and served locally from `vendor/`; no external renderer CDN, API key, or service is needed. Photograph, source records, and all scene assets are served locally. External historical sources are visited only when their links are followed.

From the repository root:

```text
node labs/monstros/tests.mjs
node labs/monstros/tests3d.mjs
```

The browser begins paused. Drag the scene to orbit and scroll to zoom. Select Cinematic, either Follow camera, or Free orbit; use Expand for fullscreen. Select a pairing and integer seed, then Run, Pause, Step, or Reset. Focus the arena for keyboard controls: Space toggles playback, Right Arrow advances one tick while paused, and R resets. Reduced-motion preferences keep the initial scene still and pause an active match if that preference changes. Hiding the page or scrolling the arena off screen also pauses playback. Auto detail disables shadows on narrow screens; Low detail caps the pixel ratio at one.

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

`model.mjs` contains the unchanged pure fixed-step transition and replay verifier. `app3d.mjs` owns playback, controls, status and downloads. `scene3d.mjs` owns the renderer, cameras, lighting, particles, tracers and resource teardown. `trucks3d.mjs` constructs the authored meshes and reversible damage states. `terrain3d.mjs` builds the seeded ground, ruts, vegetation, hills and yard structures. `app.mjs` retains the prior 2D presentation for source history and is not loaded by this page.

`tests.mjs` exercises determinism, bounded completion, reset behavior, input gates, partial replay, tamper rejection and output ownership. `tests3d.mjs` checks geometry, damage reset, anchors and terrain contracts. The UI calls game shield points “hull” without changing the replay schema or interpreting those points as armor strength.

A local copy of `narco-tank-1.jpg` is credited to ZestyMasterOfZesty, Wikimedia Commons, CC BY-SA 4.0. The original file is unchanged; the page displays it with responsive sizing and a saturation filter under the same license. See `source-records.json` for exact source, license, provenance limits, and file hash. The photograph-informed original truck visual studies are also provided under CC BY-SA 4.0 with that attribution; renderer dependencies retain their MIT license in `vendor/THREE-LICENSE.txt`.

The scene adds perspective cameras, rotating wheels, separately aimed roof props, recoil, muzzle flashes, tracers, dirt plumes, impact debris, bent panels, damaged lamps/windows, scorch, smoke and a wreck stance. Terrain relief and effects are cosmetic and do not change the deterministic match. Historical organization attribution stays in the cited archive. Cartel Kit's published-source model audit remains a separate, attributed research artifact.
