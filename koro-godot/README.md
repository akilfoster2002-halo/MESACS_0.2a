# KORO in Godot 4 — the Wano slice

The first piece of KORO running natively instead of in a browser: the planet
Wano, Mission Control's temple, the waterfall island, sakura and bamboo, 36
pandas you can ride, and the giant mecha with its skills. Same models as the
web version (the GLBs in `assets/` are uncompressed copies of the ones in
`public/`), same lon/lat placement and the same hills.

## Run it

```bash
open -a Godot koro-godot/project.godot     # the editor; press ▶ (F5) to play
godot --path koro-godot                    # or straight into the game
```

| Key | |
|---|---|
| WASD / mouse | walk, look (click to capture the mouse, Esc to free it) |
| Shift / Space | run / jump |
| E | ride the nearest panda, or climb into the mecha |
| R | get off / climb out |
| V | first person (the cockpit, in the mecha) |
| In the mecha | Shift dash · Space mega jump (hold to boost) · Q slam |

## How fast

`godot --path koro-godot res://tools/bench.tscn` warms up, then times three
seconds at three spots with vsync off. On an M1 MacBook, 1600×900:

| | browser (three.js) | Godot |
|---|---|---|
| draw calls | 1,659 | 49–130 |
| frame rate | laggy | 75–110 FPS |

Why: trees and bamboo are MultiMeshes split into chunks that are culled and
stop drawing past a distance; shadows are only cast near the camera; the 3D is
rendered at 77% and upscaled with FSR.

`godot --path koro-godot res://tools/shots.tscn -- <dir>` saves screenshots
from five places (start, the country, on a panda, the mecha, the cockpit).

## Layout

- `scripts/planet.gd` — the ball: radius, lon/lat, hills, walking on it, the ground mesh
- `scripts/world.gd` — builds Wano, the sky, the HUD, E/R/V
- `scripts/walker.gd` — you (and riding: the hips are put on the saddle each frame)
- `scripts/panda.gd`, `scripts/mecha.gd`, `scripts/scatter.gd`, `scripts/models.gd`

Rigged models are sized and centred by their **bones**, not their mesh box —
a skinned mesh is drawn where its skeleton puts it, and the retargeted mecha's
skeleton carries a scale its mesh node does not.

## Not ported yet

Everything else: the other buildings and their interiors, missions, the block
editor, the phone, accounts and multiplayer (those can talk to the same
`server/` over HTTP), the waterfall's water, the pool, the river, fireflies.

## Sharing a build

Install the export templates once (Editor → Manage Export Templates →
Download), add presets under Project → Export (macOS, Windows, Linux), and
export. See the note in the repo root's conversation for itch.io / Steam.
