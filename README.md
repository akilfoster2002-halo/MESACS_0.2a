# MESACS 0.2a — Mission: Linux

A first-person **campaign game that teaches coding**, built for the MESA CS lab.
Runs in any browser from a plain folder — no install, no build step, no network.

Sibling to [MESACS_0.2](https://github.com/akilfoster2002-halo/MESACS_0.2) (the flat desktop-navigation lesson,
still live at https://mesacs-0-2.onrender.com). This repo is the 3D campaign version.

## Running it
Open `index.html` — double-click it, or serve the folder:

```bash
python3 -m http.server 8777
```

Best on a screen 1100px wide or more. Needs hardware-accelerated WebGL
(check `chrome://gpu`; if it says llvmpipe or SwiftShader the frame rate will suffer).

## The idea
**The map is the Linux desktop.** Icons stand in the top-left, the App Launcher gate is at the
bottom, the system menu tower is top-right — the same corners they occupy on the real screen, so the
map in the student's head transfers to the machine in front of them.

**Your gun runs your program.** Enemies are shaped so the concept is the shortest path to surviving:
one drone teaches a command, five identical drones make a loop the obvious move, and the boss
regrows his shield between programs so clicking RUN repeatedly cannot win — only a loop can.

## What's built
- **Hub** — the desktop plaza: walk up to icon-doors, one click selects, double-click opens,
  the red ✕ is the only way out of an app. Live minimap of the desktop layout.
- **Mission 1 — Loops (THE LOOPER)** — block-based code console (`C` to open, time freezes),
  four stages, and a boss that forces `repeat`.
- **The Mech League** — program a battle mech and send it in without you. Four opponents,
  four chassis, five arenas, and a battle log you can step backwards through afterwards.
- Bilingual English / Español throughout, including the villain's taunts.

## Controls
| | |
|---|---|
| Move | `W A S D` or `↑ ↓` |
| Turn | `← →` or the mouse |
| Select / Open | one click / double-click |
| Run | hold `Shift` |
| Code console | `C` |

Arrow keys turn as well as the mouse, so a student who can't manage mouse-look can still play.

## The Mech League
A PvP mode where the programming *is* the fight. You never touch the controls: you write a
program, press RUN, and watch it play out against somebody else's.

```
BUILD MECH → WRITE CODE → DEPLOY → BATTLE → READ THE LOG → CHANGE A BLOCK → FIGHT AGAIN
```

The referee is a pure function — two programs, an arena and a seed in, the whole battle out:

```js
MECHSIM.simulate({ a, b, arena, rules, seed })   // → frames[], log[], result, stats
```

It has no DOM and no clock, and it runs under Node as well as in the browser, so the same
compile that a student watched is the one that judges the match. Nothing is simulated during
playback — the fight is decided before the countdown finishes, which is what lets the replay
scrub, step backwards and explain itself.

Everything a match runs on is in `MECHSIM.RULES`: block limit, energy costs, turn cap, regen,
damage. Chassis are rows in `MECHSIM.CHASSIS`, arenas are text grids in `MECHSIM.ARENAS`.

## Files
```
index.html   page shell, HUD and styles
game.js      engine: renderer, movement, rooms, minimap, desktop missions
program.js   the block language with no screen attached — compile, count, validate
code.js      block console: palette, drag, text mode, walkthroughs
combat.js    drones, boss, Mission 1 script
mechsim.js   the mech referee — deterministic, DOM-free, runs under Node too
mech.js      the arena: 3D board, countdown, battle log, replay/debug
levels.js    room layouts — edit this to add levels
strings.js   every word, in both languages
tests/       node --test, no dependencies — run with `npm test`
lib/         three.js, bundled as a classic script so file:// still works
```

`levels.js` and `strings.js` are the files to edit for new content; the engine shouldn't need touching.
New chassis and arenas go in `mechsim.js`; new opponents go in `mech.js`.

## Tests
```bash
npm test
```
No test framework to install — Node's own runner, over `program.js` and `mechsim.js`.

## Not built yet
The intro cutscene, mission select with saved progress, and the rest of the villains
(SYNTAXA — debugging, OFF-BY-ONE — counting from zero, NULLBYTE — the final boss)
with the `if` / variable / function levels behind them.
