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

## The Mecha Arena
The other kind of PvP, and it is a different sport. Here you DO touch the controls — WASD and
the mouse, all of it — and the code does the fighting:

```
the player drives            the code fights
─────────────────           ────────────────
walk, run, strafe, turn      punch, heavy, block, dodge
where to stand               when to do any of it
```

Every mecha is five parts with their own health, and the two arms and the legs each carry their
own program. The language is standing orders rather than a tape:

```
WHEN ENEMY NEAR
  IF ENEMY DISTANCE < 5
    PUNCH
  ELSE
    BLOCK
```

Twenty times a second every part with a program is asked one question — given what you can see
right now, what do you do? — and answers with at most one action. Combat is a triangle you can
write orders about: **block** beats **punch**, **heavy** goes through a guard, and a heavy roots
you long enough to be punished for it. Damage lands per part by rule rather than by dice: the
core if their guard is down, that arm if it is up, and the core plus their sensor from behind —
so flanking blinds them and turtling costs them an arm.

The server runs the match and both browsers draw what they are sent. Nothing is decided in a
browser and nothing is streamed: what goes over the wire is WASD one way and a snapshot the
other. Practice against the dummy runs the *same* simulation locally, so nobody trains against
rules that turn out not to be the real ones.

A hit is three things, not one. **Hitstop** freezes both mechas for a moment — no movement, no
state machine, no timers, no orders — which is what makes a punch feel like it weighed
something. **Hitstun** is the victim's alone: for a moment their parts take no new orders and
their driver has no steering. **Knockback** throws them, base plus growth, where the growth is
paid against how much core they have already lost, so the last hit of a round sends them further
than the first. Getting shoved out of your own reach is what hands the initiative back to the
player — closing the distance again is the driver's job, not the program's.

Those three ideas come from reading [SlopArena](https://github.com/Binoui/SlopArena) (MIT,
© MPXXV), which is a Unity game in C# and shares no code with this one.

**The damage model is drawn, not just charted.** The mecha is a rig — shoulders, elbows, hips,
knees — and every joint is driven by state the simulation already has. The legs run a walk cycle
off how fast it is really crossing the floor, so a mecha being thrown backwards runs its legs
backwards. A destroyed arm turns dead grey and hangs. Wrecked legs shorten the stride and leave
the knees bent. A core under half smokes, and the body sags with it. Whichever arm is blocking is
the one holding the shield plate, so which side is covered is something you can see and therefore
something you can walk around.

`MECHAARENA.RULES` holds every number a fight is played by; `MECHACODE` holds the events,
sensors and actions the palette is built from. Adding a sensor is a row in one of them.

```
WORKSHOP → CODE A PART → FIGHT → READ THE FEED → FIND THE READING THAT WENT THE WRONG WAY → FIGHT AGAIN
```

The feed down the left of the arena is the point of the mode: it prints your own code's
reasoning as it happens — the event, the reading, which way the test went, and what the part did
about it — so "why didn't my mecha punch?" is a question the screen has already answered.

## Files
```
index.html   page shell, HUD and styles
game.js      engine: renderer, movement, rooms, minimap, desktop missions
program.js   the block language with no screen attached — compile, count, validate
code.js      block console: palette, drag, text mode, walkthroughs
combat.js    drones, boss, Mission 1 script
mechsim.js   the mech referee — deterministic, DOM-free, runs under Node too
mech.js      the league arena: 3D board, countdown, battle log, replay/debug
mechacode.js the standing-orders language: events, sensors, decide(), the trace
mechaarena.js the live fight, stepped 20×/s — no DOM, no clock, Node too
mecha.js     the 3D arena you drive: camera, input, HUD, the why-it-did-that feed
workshop.js  the robot you click, and the block editor for whichever part
levels.js    room layouts — edit this to add levels
strings.js   every word, in both languages
tests/       node --test, no dependencies — run with `npm test`
lib/         three.js, bundled as a classic script so file:// still works
```

`levels.js` and `strings.js` are the files to edit for new content; the engine shouldn't need touching.
New chassis and arenas go in `mechsim.js`; new league opponents go in `mech.js`. New sensors,
events and actions for the live arena go in `mechacode.js`, and what they cost goes with them.

## Tests
```bash
npm test
```
No test framework to install — Node's own runner, over `program.js`, `mechsim.js`,
`mechacode.js` and `mechaarena.js`. The arena's tests are also its balance harness: they assert
the combat triangle holds, that two mechas cannot walk through each other, and that the same two
programs driven the same way produce the same fight twice.

## Saved progress
A lesson is forty minutes and a ten-level minigame is not, so the save has to remember
more than "finished". Everything rides in one JSONB bag on the account — the same one
that already carried coins and XP — so it follows a student to any machine in the lab.

```
at_<game>       the furthest level reached, written as each level OPENS.
                Every minigame reopens there; finishing clears it, so a
                replay starts at level 1. The mission card says which
                level it is about to hand you, and carries a ↺ back to
                the first one.
spot_<world>    where you were standing on KORO, on VOLTA and on your
                home planet — direction and heading only, because the
                ground under you is generated and comes back the same.
world           which of the three to open on.
char            who you are. Chosen on the sign-up form now, rather than
                found later in the Mall.
```

Writes are debounced: localStorage takes every one, Postgres gets at most one a
second, and whatever is still owed is paid with `sendBeacon` on `pagehide` and on the
first `visibilitychange` — a closed lid is how a session really ends, and it calls
nothing else.

## Getting about

`R` asks how, rather than doing one thing: **on foot**, **drive**, **fly**. It was
"get in the car" while a car was the only thing to get into.

Flight is its own step rather than a flag inside walking, because it answers a
question walking does not have: how high. The keys are the car's, so three
quarters of it is already known — `W` go, `S` slow, `A D` turn, mouse looks —
plus the two flying actually adds, `SPACE` up and `SHIFT` down. Airspeed and
climb rate are *chased* rather than set, so letting go of `W` leaves you gliding
and a turn at speed carries you wide; the body banks into the turn and pitches
with the climb. Buildings still exist at altitude: `blocked()` asks the question
at the height you are actually at, so flying over Mission Control is free and
flying through it is not. Hold `SHIFT` at the bottom and you land.

**Every world says how high its sky is**, because they are not the same size —
a ceiling that let you climb higher than VOLTA is wide would put you above a
marble. The last stretch of the climb fades in a wireframe shell, so the limit
is something you can see coming rather than something you bump into.

| world | radius | ceiling |
|---|---|---|
| KORO | 320 | 120 |
| home planet | 200 | 95 |
| VOLTA | 118 | 48 |

Height travels over the network with the two coordinates and the heading, or a
classmate overhead is a classmate walking across the field underneath you.

`B` is the other shortcut: the quick change, a strip along the bottom with every
character alive in their idle, so being somebody else is a keypress rather than
a walk to the Mall.

## Not built yet
The intro cutscene and the rest of the villains
(SYNTAXA — debugging, OFF-BY-ONE — counting from zero, NULLBYTE — the final boss)
with the `if` / variable / function levels behind them.
