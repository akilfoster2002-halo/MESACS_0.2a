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

## Files
```
index.html   page shell, HUD and styles
game.js      engine: renderer, movement, rooms, minimap, desktop missions
code.js      block console + compiler (never uses eval)
combat.js    drones, boss, Mission 1 script
levels.js    room layouts — edit this to add levels
strings.js   every word, in both languages
lib/         three.js, bundled as a classic script so file:// still works
```

`levels.js` and `strings.js` are the files to edit for new content; the engine shouldn't need touching.

## Not built yet
The intro cutscene, mission select with saved progress, and the rest of the villains
(SYNTAXA — debugging, OFF-BY-ONE — counting from zero, NULLBYTE — the final boss)
with the `if` / variable / function levels behind them.
