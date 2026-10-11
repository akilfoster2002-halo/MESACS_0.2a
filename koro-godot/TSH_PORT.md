# Porting TSH (Robin Ryu) to Godot — the plan

Goal: the whole TSH story playable in `koro-godot`, so it is tested there instead of the browser (too heavy).
The browser game in `public/tsh*.js` (~18,000 lines) is the source of truth; port behaviour, not just looks.

## Already in Godot (commit fa03907)
- `scenes/tsh_stage.tscn` + `scripts/tsh/stage.gd`: the night city (exported from the running browser game:
  `assets/tsh/city.glb`, collision boxes/ladders/spots in `city.json`, lights+fog in `lights.json`), Robin in her
  kit (`robin.glb`, all her clips), Maya on Doc Ock arms (`scripts/tsh/tentacles.gd` = `public/tentacles.js`),
  the Spider-Verse look (`shaders/tsh_verse.gdshader` = `public/tshlook.js` `verse`), third-person camera.
- `tools/tsh_export/`: re-export city/people from the browser game (README there). Godot cannot read
  KHR_mesh_quantization — `finish.sh` dequantizes. If an import fails once, delete that asset's `.import`.
- `godot --path koro-godot res://scenes/tsh_stage.tscn -- <dir>` photographs the stage and quits (how to verify).

## Night one is ported (scenes/tsh.tscn)
- wake + lesson (`game.gd` opening/fall/lesson, `boots.gd`), deal (`game.gd` fight_intro/outro, `fight.gd`).
- raid: `raid.gd` (billboard film, the three WFC fights' films, home, 3 AM watchers + Maya's arms, END OF
  PROLOGUE) and `chase.gd` (tshchase.js: run/van/wall/roofs/rappel/hide/call/found/home, missiles, hunter drones,
  gunship + searchlight + strafing runs, vault/slide, gecko-cuff climb, cover, Mom's call, heat stars, caught →
  the stretch again). `fight.gd` takes `setup({arena, blocks, floor, meet, uniform})` + `start(cb, "brawl")`.
- Photograph: `-- shots <dir>` (opening, lesson), `-- fightshots <dir>` (alley → raid), `-- raidshots <dir>`
  (billboard → every chase stage → the three fights → home → 3 AM → end).
- Not yet: the alt branch (Kai in the flat), day two.
- The Spider-Verse post quad reads the screen before transparent things draw: give anything transparent
  `render_priority = 101` or it disappears.

## The story (public/tshai.js QUEST + STORY), in order — port beat by beat, each playable before the next
Night one: wake (buyer's call, kit on, out the window) → lesson (falls, shoes fire; over the roofs to Dragon Alley)
→ deal (the buyer and his crew: the fight, tshfight.js) → raid (billboard, WFC; chase stages tshchase.js; hide
from the gunship; Mom calls) → night (in at the window 3 AM; Maya & Kai watch through binoculars; the arms reveal)
— alt branch news/home/apt/escape/chair/escape2/out (Kai in the flat).
Day two: morning (8:42 alarm) → commute (roofs to school) → school (lobby, guard, teacher) → sneak → detention
(robotics lab, Psi, puzzle tshpuzzle.js, tshlab.js) → after (teacher talk) → courtyard (Canon, Harbor Lane
Station, tshsubway.js; Maya & Kai; alpha monster tshalpha.js; chase) → gethome → evening (bedroom).

## Systems to port first (everything uses them)
1. Story state `S` + beats + checkpoints/save (tsh.js fresh/save/restore/checkpoint, tshai.js QUEST/CHECKPOINT/STORY).
2. Dialogue: `LINES` (tsh.js ~line 70) + recorded voices `public/tsh/voice/<vkey>.mp3`, vkey = FNV-1a of
   `who + '|' + text` (tsh.js vkey); subtitles; FEELS/FEEL face expressions (old Robin: jawOpen, smile, mouthO,
   frown, browUp, browDown, blink morphs; her mouth opens — glb files/face/mouth.mjs).
3. Cutscenes: `playReel` shot lists (cam/look/fov/dur/beats/enter/tick) and `cutscene` — port as a data-driven
   shot player; gaze (gazeTick in tsh.js) turns her head to the talker/shot subject.
4. Robin's moves: boots.js (charged jump, bound, dive, pull-up, dash, wall kick — physics is plain data, port
   body()/step()), ladders, hide, flash/jam/can gadgets, shades, heat/stealth (tshai.js HEAT, perceive).
5. NPCs: civilians, WFC officers (perception, pursue, grab), drones, Kai, Maya, Canon, school people.
6. Audio: `public/tsh/sfx`, `tsh/music` (tshscore.js cue map), voices. Interiors: export aptGroup, school, sub
   groups with tools/tsh_export (extend export.js to them, like the city).

## Verify
Every beat: photograph it with the stage's `-- <dir>` mode (add shots per beat) and read the PNGs; run
`npm test` for the browser side untouched. Ship every change to main.
