# Monstros

A Cartel Kit vehicle study combining a licensed historical photograph, attributed source records, and a real-time WebGL 2 scene. Three original truck meshes interpret the visible body proportions, enclosed plating, wheels, and roof fixtures in the references. They are authored visual studies, not measured reconstructions or photogrammetry. Movement, damage, and outcomes remain game abstractions; the historical archive does not calibrate the engine.

## Run and inspect

Serve this directory through a static web server, or use the published portfolio lab. The browser requires WebGL 2. Three.js 0.186.1 and OrbitControls are pinned and served locally from `vendor/`; no external renderer CDN, API key, or service is needed. Photograph, source records, and all scene assets are served locally. External historical sources are visited only when their links are followed.

From the repository root:

```text
node labs/monstros/tests.mjs
node labs/monstros/tests3d.mjs
node labs/monstros/tests-mesh-detail.mjs
node labs/monstros/tests-presentation.mjs
node labs/monstros/tests-play.mjs
```

The browser opens in the garage. Choose any of the three truck studies, drag to orbit, scroll to zoom, and use the damage slider to inspect or repair the mesh. Drive & fight gives you control of the first vehicle against an arcade opponent. W/S or Up/Down drive and reverse, A/D or Left/Right steer, Space fires, Shift boosts, X brakes, Q/E aims the turret, P pauses and R resets. Aim assist tracks the rival unless overridden by manual aim. Rechargeable boost has an exhaustion lock until its recovery threshold. The camera follows the player during driving; pause to inspect from other angles. The mini-map identifies the player in white and the rival in red. Touch buttons support simultaneous held inputs and release when a pointer is cancelled or focus leaves the game.

Watch runs the unchanged autonomous v1 duel. Its Action director switches close camera subjects every six simulated seconds; Wide cinematic, either Follow camera, and Free orbit remain available. Golden hour, Blue hour and Overcast change the lighting without changing the match. Expand uses native fullscreen, with an in-page fallback. Sound is synthesized locally and starts only after selecting Sound on.

Select a pairing and integer seed, then start, pause, single-step, or reset. Watch-mode keyboard controls use Space for playback, Right Arrow for one paused step, and R to reset. Driving stays at normal time; Watch permits playback-speed changes. Reduced-motion preferences keep the initial scene still and pause an active match if that preference changes. Hiding the page or scrolling the arena off screen also pauses playback and quiets audio. Losing window focus pauses and releases driving input. Auto detail disables shadows on narrow screens; Low detail caps the pixel ratio at one. `?play=1` opens paused driving; `?duel=1` opens paused Watch mode.

The `?embed=1` view is the compact version used on the Cartel Kit page. It uses the same engine and controls.

## Rules and evidence boundary

- Simulation time advances at 30 fixed steps per second. Playback speed affects the clock-to-tick schedule, never the step calculations.
- Two fictional units move around geometric cover and emit abstract arcade pulses. A pulse that meets cover disappears; a pulse that meets the other vehicle subtracts invented shield points.
- The seed drives one documented 32-bit linear congruential generator. Movement order, event order, rounding in the exported summary, and the arcade constants are fixed in `model.mjs`.
- A match ends when a shield reaches zero or at 2,400 ticks (80 simulated seconds). At the time limit, the greater proportion of initial shield remaining wins. Equal proportions draw.
- This is an intentionally small simulation. Movement and collision checks use discrete ticks, not continuous physical dynamics. The units are arbitrary game coordinates. There is no physical calibration or real-world inference.
- Pulses are capped at 40 and the event ledger at 400 entries. Exported values contain setup, bounded events and a deterministic result rather than executable code.

## Replay verification

Export is available at tick zero, during a match, and after completion. The browser import accepts JSON up to 256 KiB and routes supported schemas to their own verifiers. Watch exports retain `monstros-replay/v1` and `monstros-arena/v1`; `replayRecord()` reconstructs that autonomous match from its setup. Drive exports use `monstros-play-replay/v2` and `monstros-drive/v2`; `replayPlayRecord()` executes the saved canonical input runs and compares the result and event history. A run is `[ticks, throttleMilli, steerMilli, aimMilli, flags]`; axes are bounded integers at thousandth resolution, with flags for fire, aim assist, boost and brake. Runs are positive, adjacent equal runs merge, and total input length equals the tick count. Changed inputs/results/events, noncanonical runs, unsupported versions and terminal tick padding are rejected.

This establishes consistency with this engine, not authenticity or a digital signature. An author can construct a new valid replay by running the public rules. Keep the engine version with the replay; future rule changes require a new version.

## Source

`model.mjs` contains the unchanged pure fixed-step transition and replay verifier. `app3d.mjs` owns playback, controls, status and downloads. `scene3d.mjs` owns the renderer, cameras, lighting, particles, tracers and resource teardown. `trucks3d.mjs` constructs the authored meshes and reversible damage states. `terrain3d.mjs` builds the seeded ground, ruts, vegetation, hills and yard structures. `app.mjs` retains the prior 2D presentation for source history and is not loaded by this page.

`play-model.mjs` adds the separate pure driving engine: gradual acceleration, reverse, speed-dependent steering, independently aimed turret, boost, bounded collisions, a progressing opponent, and swept pulse intersections. All mechanics remain invented arcade choices. `input3d.mjs` contains keyboard and pointer ownership; it never handles editable fields as driving input, clears held controls on pause/focus loss, and captures touch pointers until release/cancellation. `tests-play.mjs` adds 33 checks for mechanics, collisions, deterministic recorded actions and hostile replay inputs. Together with the existing suites, this revision has 84 passing headless checks; UI and GPU behavior are verified separately.

`tests.mjs` exercises determinism, bounded completion, reset behavior, input gates, partial replay, tamper rejection and output ownership. `tests3d.mjs` checks geometry, damage reset, anchors and terrain contracts. The UI calls game shield points “hull” without changing the replay schema or interpreting those points as armor strength.

The detail revision adds compound tapered and chamfered cab/hood sections, rounded tire profiles and staggered tread, recessed wheels, chassis shafts, leaf springs, dampers, door hardware, and closed plate meshes whose vertices dent progressively. Repair restores the original vertex positions exactly. `tests-mesh-detail.mjs` checks these contracts. `presentation3d.mjs` builds the garage, sky, bounded fragment pool and wheel-trail ring buffer; seven checks in `tests-presentation.mjs` cover finite geometry, capacities, expiry and reset. `audio3d.mjs` owns the optional Web Audio lifecycle. The 14 engine, 21 original 3D, 9 mesh-detail and 7 presentation checks total 51 base checks; the driving suite brings the total to 84. Browser visuals and controls require separate verification.

A local copy of `narco-tank-1.jpg` is credited to ZestyMasterOfZesty, Wikimedia Commons, CC BY-SA 4.0. The original file is unchanged; the page displays it with responsive sizing and a saturation filter under the same license. See `source-records.json` for exact source, license, provenance limits, and file hash. The photograph-informed original truck visual studies are also provided under CC BY-SA 4.0 with that attribution; renderer dependencies retain their MIT license in `vendor/THREE-LICENSE.txt`.

The scene adds perspective cameras, rotating wheels, separately aimed roof props, recoil, muzzle flashes, tracers, dirt plumes, impact debris, bent panels, damaged lamps/windows, scorch, smoke and a wreck stance. Terrain relief and effects are cosmetic and do not change the deterministic match. Historical organization attribution stays in the cited archive. Cartel Kit's published-source model audit remains a separate, attributed research artifact.
