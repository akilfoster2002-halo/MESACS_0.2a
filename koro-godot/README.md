# KORO in Godot 4 — Wano

KORO running natively instead of in a browser: the planet Wano, Mission
Control's temple (walk in — the atrium, the mirror pool, blossom through the
oculus), the Workshop, the Mall (everybody on a dais — E to be them), the
Mechanic (the cars on their bays, and the Mechanic), the Library (Ada, and
the book of every idea in the language), four sky islands you can fly to and stand on, the waterfall with its
plunge pool, fish, turtles and a river that finds its own way downhill, four
thousand fireflies, sakura and bamboo, 36 pandas you can ride, your car, and
the giant mecha. Same models as the web version (the GLBs in `assets/` are
uncompressed copies of the ones in `public/`), same lon/lat placement and
the same hills.

## Run it

```bash
open -a Godot koro-godot/project.godot     # the editor; press ▶ (F5) to play
godot --path koro-godot                    # or straight into the game
```

| Key | |
|---|---|
| WASD / mouse | walk, look (click to capture the mouse, Esc to free it); scroll to zoom |
| Shift / Space | run / jump |
| F | fly — W to fly, A D bank, Space up, Shift down, F again to land (you fall) |
| E | ride the nearest panda, get in the car, or climb into the mecha |
| R | your car comes to you — or get out / get off / climb out |
| V | first person (the cockpit, in the mecha) |
| G, 1 2 3 | dance and emotes |
| B | who you are — Kyle, Mia, Savannah, Carlos or Robin |
| T | the phone — Nearby is the room's chat, Texts go to anybody by username |
| O | who is here |
| P | pause — and **Your account**, to sign in |
| In the car | W throttle · S brake then reverse · A D steer (only when rolling) · mouse looks round |
| In the mecha | Shift dash · Space mega jump (hold to boost) · Q slam |

Walk into water deeper than you are tall and you swim. Fly into the falls
and they push you down and out.

## Your account, and your class

P → **Your account**: the address of your class's KORO server (the same one
the website runs on), then sign in or make an account. It is the same account
as the website's — the progress bag (coins, XP, what you own, which car, who
you are) is the one on your account, merged with anything done here first,
and it is saved back as it changes. You stay signed in between launches.

When the server holds rooms (the Mac app, `npm run dev`, `npm start` — not the
serverless website, which cannot keep a socket open) you are in the room you
picked with everybody else in it, whether they are in a browser or here: you
see them where they are, as who they chose, in their car, dancing, flying;
they see you; the room's chat is on the phone and along the bottom of the
screen. Texts work either way.

`KORO_PROFILE=name` keeps a separate self in `user://name/`, for running two
copies side by side. `tools/netcheck.gd` signs in against a server, stands in
the Meadow and screenshots what it sees.

## How fast

`godot --path koro-godot res://tools/bench.tscn` warms up, then times three
seconds at each of four spots with vsync off. On an M1 MacBook, 1600×900:

| | browser (three.js) | Godot |
|---|---|---|
| draw calls | 1,659 | 70–490 |
| frame rate | laggy | 95–150 FPS |

Why: trees and bamboo are MultiMeshes split into chunks that are culled and
stop drawing past a distance; the fireflies, the spray, the petals and the
flight streaks are each ONE draw call whose motion is worked out on the
graphics card; shadows are only cast near the camera; the 3D is rendered at
77% and upscaled with FSR. `KORO_TIMING=1` prints how long each part of the
world takes to stand up (about 2.3 s in all; the big models load on threads).

`godot --path koro-godot res://tools/shots.tscn -- <dir> [name]` saves
screenshots from sixteen places and cards — the start, the temple atrium,
the falls, in flight, the garden island, swimming, the car, the river, inside
the Mall, the Mechanic and the Library, the Workshop, the book, the picker,
the pause card, the mecha. `tools/probe.gd` looks at one building on its own.

## Layout

- `scripts/planet.gd` — the ball: radius, lon/lat, hills, the pool's basin, the ground mesh
- `scripts/world.gd` — builds Wano and answers the four questions everything
  that moves asks: `floor_at`, `blocked`, `water_at`, `fall_push`. The hills
  are sums; everything solid on them is a physics collider, so the same ray
  that finds the grass finds an island's deck or a roof
- `scripts/walker.gd` — you: walking (sliding along walls), swimming, flying
  (the bank is the cause and the turn the effect), emotes, the camera
- `scripts/building.gd` — the Workshop, Mall, Library and Mechanic: the plate
  (flat room, apron bent down to meet the ball), the shell, what makes a box a
  building, the room inside and each one's furniture; E at a console
- `scripts/progress.gd`, `scripts/wallet.gd` — the progress bag the browser
  keeps (coins, XP, what you own, which car, who you are), and what it adds up to
- `scripts/car.gd`, `scripts/car_model.gd`, `scripts/panda.gd`, `scripts/mecha.gd` — the things you get in or on
- `scripts/temple.gd` — Mission Control: the model, its walls and roofs from
  `assets/temple_layout.json` (written by `glb files/temple/build.py`), the pool, petals, doves
- `scripts/islands.gd` — the four sky islands, the falls, the plunge pool, the river, fish, turtles
- `scripts/water.gd` — the water shaders and the shapes they are drawn on
- `scripts/net.gd` — the account (HTTP, the `mq` cookie), the progress bag on
  it, the room (the /ws socket: `join`, `pos`, `chat`, `players`), the phone's API
- `scripts/others.gd` — everybody else in the room, drawn and eased
- `scripts/account.gd`, `scripts/phone.gd` — the sign-in card and the phone
- `scripts/ctl.gd` — the keys as the game reads them, shut while you type
- `scripts/fireflies.gd`, `scripts/scatter.gd`, `scripts/hud.gd`, `scripts/settings.gd`, `scripts/models.gd`

Rigged models are sized and centred by their **bones**, not their mesh box —
a skinned mesh is drawn where its skeleton puts it, and the retargeted mecha's
skeleton carries a scale its mesh node does not.

## Not ported yet

The other worlds (VOLTA, RYU, your home planet) and the ship that flies you
there. Missions and the block editor
are staying in the browser.

## Sharing a build

Install the export templates once (Editor → Manage Export Templates →
Download), add presets under Project → Export (macOS, Windows, Linux), and
export. See the note in the repo root's conversation for itch.io / Steam.
