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
- **Title screen** — the planet **Senio**, live and turning, drawn by the same value
  noise and soil ramp as the world you land on. Not a picture of the game: the game's world,
  with its towns coming round the limb. (KORO is the name of the game; Senio is the planet.)
- **Senio** — the hub world. Buildings that stand on something: a plinth cut into the apron,
  corner pilasters, eaves, lit window rows and a stepped threshold, with a furnished room behind
  every door. **You can land on the roofs.**
- **The sky islands** — four of them hanging over Senio inside the flight ceiling, and ordinary
  ground as far as the game is concerned: fly up, land, walk about. **The Falls** carries a lake
  that runs off its rim, falls the whole way down to a plunge pool, and **leaves the pool along a
  river** — which finds its own course by steepest descent over the terrain that is already there,
  so the water runs downhill because the hill is downhill. It is the only water on Senio, which is
  why the fish and turtles live there. The turtles walk somewhere, stop, and do nothing for a
  while, which is most of what a turtle does.
- **Hub** — the desktop plaza: walk up to icon-doors, one click selects, double-click opens,
  the red ✕ is the only way out of an app. Live minimap of the desktop layout.
- **Mission 1 — Loops (THE LOOPER)** — block-based code console (`C` to open, time freezes),
  four stages, and a boss that forces `repeat`.
- **The Swarm — Loops** — Space Invaders with the authorship turned round: you write one
  program and the whole formation flies it. **Twenty stages, and every one of them is a loop —
  there is no `if` in this game, no repeat-until and no sensor.** The ladder asks the four
  questions a loop asks: **what goes in the body**, **how many times**, **what goes after the
  end**, and **which loop it is** — `repeat (N)` when you know the number, `forever` when you
  cannot work it out, and never `forever` with something waiting after it, because nothing
  after it runs. `nextRow()` is the star, because `nextRow()` inside a loop builds a column and
  `nextRow()` between loops builds rows, and a shape is something you can see; `across()` moves
  the swarm into range, so *move there, THEN fire* is a placement lesson rather than a
  condition; and nested loops are the **final challenge**. The shield is a count of hits: every
  `fire()` that lands takes one off, the fortress shows exactly that many segments, and the
  block budget is what forces the loop. Every new block is **introduced, then practised**: the
  stage that brings it is walked (the console opens itself and the coach rings each block), and
  the stage after it is practice — no coach, the answer behind a Hint button. The build stages
  draw the formation they ask for as an outline to fill, with a cursor showing where the next
  `spawn()` lands, and wrong placement gets its own sentence: *you fired too early*, *look
  where the invaders went*, *you fired 3 times before you got there*.
- **The Mech League** — program a battle mech and send it in without you. Four opponents,
  four chassis, five arenas, and a battle log you can step backwards through afterwards.
- **The Ring** — pick NOISY BOY or AMBUSH and program what its keys do with blocks. Nothing is
  bound for you: if you did not write the rule, the key does nothing.
- **Mission 7 — The Engineer's Trail (conditionals)** — the first mission that asks a student
  to **read** a program instead of writing one, and the only one that is a **detective story**.
  A delivery robot that will not stop, a gate that opens for nobody, a train that stops at a
  station that closed four years ago and a door whose log for that night is blank. Walk up to
  any of them, press `E`, and the **Machine Inspector** shows you the rule it is actually
  obeying, the switches that feed it, and a `RUN TEST` button — and the district does the thing
  while the rule is still on the screen beside it. Nobody is told they are in a lesson about
  `if`; they are told to find out who did it.
- **Mission 8 — Ion (conditionals and boolean logic)** — reached from the Ion station on
  the floor of Mission Control, which is the only door RYU has. You wake up in a house and
  your robot is on the floor of the next room, saying half a sentence over and over. His
  morning routine is open on his chest, and **seven of its nine decisions are about asking the
  right question**: one `if` for whether he got to the kitchen, and under it a rule that makes
  pancakes when the pan is hot **and** there is batter, and an `else if` that has to catch
  every morning the first one turned down. The only rule that does is the first one turned
  inside out — both sides flipped and `and` swapped for `or` — which is De Morgan's law,
  arrived at by reading a table of four mornings rather than by being told its name. The last
  `else` is `wait`, and it should never run: a morning that reaches it is a morning neither
  question caught. Nothing is marked against an answer key — the console runs the program and
  shows what Ion did on every morning there is. Then the lights go out, and it turns out
  somebody else has been in his code.
- **Mission 9 — The E-45 (boolean vocabulary)** — Ion has asked to be taken to the
  Mechanic, and the ship parked outside the house will not start. Her pre-flight
  checklist has had the **operators taken out of it**. Nine safety rules
  and nine words — `<` `>` `<=` `>=` `==` `!=` `and` `or` `not` — one word to a rule, with
  the whole vocabulary on screen the entire time and what each one is called written under
  it. The hard part is never remembering the name, it is the **boundary**: every rule is
  judged against readings out of the ship's own log, and the log always contains the line
  where the two words a student confuses come apart. FUEL is tried at exactly 20, CARGO at
  exactly 400, the pad at exactly freezing — which is the only place "at least" and "more
  than" are different things. Put `and` between two numbers and the console explains what
  `and` is for rather than saying no: these nine are three different parts of speech, and
  knowing which is which is most of knowing them.
- Bilingual English / Español throughout, including the villain's taunts.

## How it is lettered
A game about writing code is set in code type — three monospaces, each with one job:

| | face | where |
|---|---|---|
| display | **Space Mono** | the logo, screen titles |
| interface | **Ubuntu Mono** | buttons, briefings, labels, the HUD — and the signs in the 3D world |
| code | **JetBrains Mono** | programs, and only programs: blocks, the text mirror, the tape |

They are **bundled, not linked** (`public/fonts`, 84KB for the set) because the whole
premise is a folder that opens with no install and no network — a font CDN would quietly
un-letter the game on the first lab machine with the internet off. Ubuntu Mono is under the
Ubuntu Font Licence; Space Mono and JetBrains Mono are under the SIL Open Font Licence.
All three allow redistribution. Each role falls back to the system monospace.

Canvas text in the 3D world reads the same CSS variable the page does, so there is one
typeface setting rather than eleven copies of one — and labels that outgrow their sign
**shrink to fit** rather than being condensed by `fillText`'s `maxWidth`, which matters most
in Spanish (`CONTROL DE MISIONES` against `MISSION CONTROL`).

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

## The Ring — NOISY BOY vs AMBUSH
A card on Mission Control and a console in the hall. It is deliberately one sentence long
at the moment:

```
WHEN [D] IS PRESSED
  STEP RIGHT
```

**The program IS the controls.** Nothing is bound to a key for you. Press D on a robot with
no rules and nothing happens, and the screen says so — the only way to move is to have said
so in a block. The first time a student presses their own key and four metres of robot walks,
they have written a program that did something to a body with legs, and that is the whole
lesson this stage is for.

```
PICK A ROBOT → SAY WHAT A KEY DOES → PRESS IT → CHANGE YOUR MIND
```

**The bodies are the real bodies.** `noisyboy.glb` and `ambush.glb` are rigged exports —
thirty-three bones, fourteen clips — loaded straight out of `public/characters/models`, the
same files the arena on RYU uses. Nothing is approximated out of boxes.

| | NOISY BOY | AMBUSH |
|---|---|---|
| | tall and light on his feet | short and heavy |
| across the floor | 5.8 m/s | 4.6 m/s |

**No walk cycle yet.** Neither file has one — the clips are idle, jab, hook, cross,
roundhouse, flykick, sweep, block, dodge, hit, floored, getup, roar and uppercut, and none of
those is a loop you can travel on. So the robot slides while playing `idle`, which is honest
about what it is rather than faking it with a dodge hop. **When a walk clip arrives it needs
no code:** put it in the `.glb` under any of the names in `WALK_CLIPS` at the top of
`ring.js` and it is found and played while moving. If it is called something else, add the
name to that list — one line, which is why it is a list and not an `if`.

**The first rule whose key is held wins.** That is the only rule about order, and it is why
every row can be moved up and down. An empty rule that matches still wins and still does
nothing — falling through to the next rule on the same key would quietly make the language
"the first *non-empty* rule wins", which is a subtler rule than the screen teaches. The feed
says `D has nothing to do` instead, which is how you find out it is there.

**The feed is the point.** Down the left, as it happens, is your own program's reasoning in
the words the blocks are written in — the key that fired and what it reached — printed only
when the decision *changes*, because at twenty ticks a second a held key is the same sentence
two hundred times a minute.

`MECHACODE` holds the keys and the actions; `BOUT.RULES` holds every number the floor is run
by; `robots.js` is a row per robot. Adding an action is a row in the first and a case in the
ring.

### What is not here yet
Pulled back on purpose, to be built on top of this: the arms and their programs, sensors and
`IF`, the opponent, damage, and the two-player match. The combat model and its server lobby
are in the history at `0b8e547` if any of it is worth lifting back out.

## Files
```
index.html   page shell, HUD and styles
game.js      engine: renderer, movement, rooms, minimap, desktop missions
program.js   the block language with no screen attached — compile, count, validate
code.js      block console: palette, drag, text mode, walkthroughs
combat.js    drones, boss, Mission 1 script
islands.js   the sky islands: the rock, the lake, the waterfall and the wildlife
title.js     the landing screen: Senio in orbit, its weather, and the stars behind it
invaders.js  the swarm: twenty loop stages, the fortress, and the shield you count
mechsim.js   the mech referee — deterministic, DOM-free, runs under Node too
mech.js      the league arena: 3D board, countdown, battle log, replay/debug
mechacode.js the key language: WHEN <key> IS PRESSED → <action>, and the trace
robots.js    NOISY BOY and AMBUSH as data — which model, how tall, how fast
bout.js      one robot on a floor, stepped 20×/s — no DOM, no clock, Node too
pit.js       pick a robot and say what its keys do
ring.js      the robot as you see it: the .glb, the camera, the feed
logic.js     the decision engine every Koro machine thinks with — conditions
             as trees, ladders of branches, truth tables. No DOM, Node too
trail.js     The Engineer's Trail: the district, the machines, the witnesses,
             the inspector, the notebook and the case
routine.js   Ion's morning routine: the program, the two rules and the four
             mornings they are judged on. No DOM, Node too
ionfix.js    his console — the blocks, the walkthrough and the morning table
house.js     the house on RYU: two rooms, the robot on the floor of one, and
             what happens to him after you mend him
preflight.js the E-45's checklist: nine rules, nine words, and the log they
             are judged against. No DOM, Node too
shipfix.js   the pre-flight panel — the word bank, the blanks and the readings
levels.js    room layouts — edit this to add levels
strings.js   every word, in both languages
tests/       node --test, no dependencies — run with `npm test`
lib/         three.js, bundled as a classic script so file:// still works
```

`levels.js` and `strings.js` are the files to edit for new content; the engine shouldn't need touching.
New chassis and arenas go in `mechsim.js`; new league opponents go in `mech.js`. A new robot for
the ring is a row in `robots.js` and a `.glb` beside the others; a new key or action for it is a
row in `mechacode.js`.
A new stage for The Swarm is a row in `invaders.js`'s `STAGES`: the palette it hands out, the
fortress it puts up, and what counts as done — and `tests/invaders.test.js` will tell you if the
numbers you picked have quietly made its loop optional, play the stage through with the worked
answer you wrote for it, and refuse a conditional block anywhere on the ladder.
A new **machine** is a row in `logic.js`'s `MACHINES` and a row per action in `trail.js`'s
`ACTIONS`; a new **witness** is a row in `PEOPLE`; a new **clue** is a row in `CLUES`. Nothing
in the inspector knows what a gate is, so a rule about loops or variables draws itself.

## Tests
```bash
npm test
```
No test framework to install — Node's own runner, over `program.js`, `mechsim.js`,
`mechacode.js` and `bout.js`. The ring's tests are driven with a plain `Set` of key codes and
no browser: they assert that an unprogrammed key does nothing, that the first rule whose key is
held is the one that runs, that the robot cannot walk off either end, and that every action on
the palette is one the floor can actually carry out.

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
spot_<world>    where you were standing on VOLTA and on your home planet —
                direction and heading only, because the ground under you is
                generated and comes back the same. NOT Senio: the hub always
                lands you outside Mission Control's door, so the walk to the
                first instruction is the same walk for everybody.
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

The sky islands hang between 48m and 95m over Senio, inside its 120m ceiling — a deck you
cannot reach is worse than no deck at all, and `tests/senio.test.js` checks the arithmetic.

| world | radius | ceiling |
|---|---|---|
| Senio | 320 | 120 |
| home planet | 200 | 95 |
| VOLTA | 118 | 48 |

Height travels over the network with the two coordinates and the heading, or a
classmate overhead is a classmate walking across the field underneath you.

`B` is the other shortcut: the quick change, a strip along the bottom with every
character alive in their idle, so being somebody else is a keypress rather than
a walk to the Mall.

## The Arcade

Everything needed to MAKE a game was already here — `blocks.js` is the language,
`vm.js` runs it, `coder.js` edits it, Free Play is the room. What was missing was
the half that makes any of it worth doing: somebody else playing it.

```
FREE PLAY → PUBLISH → a cabinet on VOLTA → somebody plays it
                                         → they rate it
                                         → the author reads that
```

A game is made **in the arcade**. Walk into the building on VOLTA, press MAKE A
GAME, and the block editor opens in the room behind it — a cabinet you can play
and a bench you can build at, in the same room. Your own games sit at the top of
the shelf with an OPEN chip that puts one back on the bench; publishing again
updates that cabinet rather than opening a second. The bench has its own project
slot, so it and Free Play's sandbox cannot overwrite each other. The arcade is a building on VOLTA: a shelf of cabinets showing
title, author, stars and plays. Play one, press `Esc`, and you are asked what you
thought — five stars and one optional line. Publishing again under the same name
replaces the game rather than adding a second cabinet.

**2D is a camera, not a second engine.** `move`, `turn` and `point towards`
already act on x and z with `dir` as a compass heading, which *is* a top-down 2D
stage — so a project marked flat gets an orthographic camera overhead and the
keys are handed to the game instead of to your legs. Every motion block was
already right for it.

Three things it is careful about, all of them because this is the first thing in
the game a child makes that other children read:

- **A visitor never writes on the author.** `VM.adopt()` runs their project in
  your browser with saving turned off, on a deep copy — their program can spawn
  clones and set variables and none of it is kept. You cannot break a game by
  playing it.
- **Every word a child wrote is capped by the server and rendered with
  `textContent`.** Both, because either alone is one mistake from a class
  finding out.
- **A teacher can take any game down.** Hidden rather than deleted, so hiding
  the wrong one is reversible. Chat is never stored at all; a game is, and that
  difference is the reason this needs a moderation path and chat does not.

Publishing is the only route that accepts a large body — it gets its own 320kb
limit, and sign-in and chat keep the 16kb ceiling they should always have had.

## Who is here

`O`, or the 👥 button. A strip along the bottom listing everybody online,
grouped by the room they are in, with their face and what they are doing —
outside, in the Workshop, in a mission, driving, flying between planets.

The server has always known this: `live` is every open socket, carrying the
room it joined and the door it last walked through. Nothing ever showed it to
anybody but a teacher, which is a strange gap in a game whose multiplayer pitch
is that your class is in here with you.

`/api/who` reads no tables, so it sits above the database gate with `/health`
and `/servers` — but it does need a signed-in cookie, checked from the HMAC
alone. A public endpoint listing the display names of a room full of children
is not a thing to ship. Students only, which is the convention the in-world
roster already follows: a teacher is not drawn as a body in a room either.

## The Engineer's Trail
A mystery you solve by reading machines, and the answer to a question this game had not
asked before: **what does a student do with a program somebody else wrote?**

```
OBSERVE → FORM A THEORY → INSPECT THE RULE → SET THE READINGS → RUN → UPDATE THE THEORY
```

The district is a text floor plan — one string per row, exactly like the infiltration site —
walked with the same legs, the same collision and the same over-the-shoulder camera as
everywhere else. The witnesses are the same rigged characters you could be wearing. `E` means
what it has always meant. None of it is a second engine.

**A machine is a rule, some switches, and a mapping from what it decides to what the district
does about it.** That is the whole abstraction, and it is why the mission teaches six ideas
with one panel and no special cases:

| where | the rule | the idea |
|---|---|---|
| Bay 14 sensor | `if package_on_pad:` | a bare **if** — and *nothing* is an answer too |
| Delivery robot KR-9 | `if … else …` | **else**: two roads, and it is stuck on the wrong one |
| Perimeter gate 3 | `if badge_valid or maintenance_override:` | **or**: one word, added, was the whole crime |
| Transit car 2 | `if authorized_vehicle and emergency_signal:` | **and**: a stop is two deliberate things |
| Maintenance door | `if / elif / elif / else` | **elif**, and that **order is meaning** |
| The engineer's terminal | an `and` of all four | **combining** conditions over real evidence |

The maintenance door is the one the mission is really about. `emergency` sits above
`maintenance_mode`, and it is `maintenance_mode` that writes the log — so the branch that
would have recorded who came through that night was never *asked*. Nothing was erased.
Nothing was ever written. The inspector draws unasked branches as their own state, greyed and
labelled **never asked**, because a branch under a true one is not false; and the ▲▼ handles
let a student move one line and watch the same switches produce a different answer.

**The terminal has no switches.** Its four readings are what is actually in the notebook, so
the cross-reference is only as true as the evidence under it — which is the point being made
rather than a puzzle about it.

**Nobody is punished for a wrong theory.** A test that comes out the way you did not expect
prints its result like any other; a wrong name gets a sentence explaining what rules that
person out, and an invitation to try another.

Four witnesses each know one true thing and have a reason to know it — the officer knows what
a gate log looks like and nothing about a delivery round. `tests/trail.test.js` asserts that
no single one of them can both name the man and carry the code, so the case cannot be
short-circuited by talking to the right person.

Progress rides in the same save bag as everything else, so the investigation survives a
closed lid: the gate you opened is open when you come back, the crate is still on the dock,
and the notebook is as you left it. Solving it clears the bag, so a replay is a new case.

## Not built yet
The intro cutscene and the rest of the villains
(SYNTAXA — debugging, OFF-BY-ONE — counting from zero, NULLBYTE — the final boss)
with the `if` / variable / function levels behind them.
