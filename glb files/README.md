# Character pipeline

How a rigged character gets from a Mixamo FBX into `public/characters/models/`.
Nothing in here is loaded by the game; the only output the game needs is the
final `.glb`, and the intermediates are gitignored.

```bash
cd "glb files"

# 1. FBX -> rigged glb. Mesh, skeleton, skin, computed normals.
#    Comes out at 1/100 with 100 on the scene root — the scale every
#    character and every clip in rig/ is stored at.
node fbx2glb.js "../animations/Savannah/savannah final.fbx" savannah-rigged.glb

# 2. Paint it. Vertex colours by bone and by height; no UVs needed.
node paint-skinned.js savannah-rigged.glb savannah-painted.glb savannah.paint.json

# 3. Add the five clips the game asks for by name.
node merge-clips.js savannah-painted.glb savannah.glb dropbase \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb \
  jump=rig/jump.glb dance=rig/dance.glb \
  inplace=walk,sprint,jump,dance trim=jump:0.4166:1.2918

cp savannah.glb ../public/characters/models/character-u.glb
```

`inplace` flattens the fore/aft root motion: Mixamo walks the hips forward and
here the keys decide where the body is, so a clip that also moved it would
slide the character away from itself once per loop. `trim` cuts the long crouch
off the front of the jump. Both are the settings Mia already ships with.

## The tools

| | |
|---|---|
| `fbx-read.js` | binary FBX 7500+ into a node tree — records, properties, deflated arrays |
| `fbx2glb.js` | one mesh, one skeleton, one skin out of that tree and into a glb |
| `fbx2clip.js` | the opposite: an ANIMATION out of an FBX, with no character in it |
| `png-read.js` | a PNG into RGBA, so reference art can be **measured** rather than eyeballed |
| `paint-skinned.js` | vertex colours decided by the rig — see below |
| `paint-rigged.js` | the older painter, height bands only. Kyle and Mia were painted with it |
| `weld-rigged.js` | merge vertices without losing joints and weights |
| `merge-clips.js` | Mixamo's one-clip-per-file into one glb, retargeted by bone name |
| `preview.html` | a character sheet under the game's own lights |
| `preview-anim.html` | every clip, sampled across its length |
| `preview-png.html` | the 256×328 roster thumbnail, in the idle, on transparency |
| `png-sink.js` | somewhere for that page to PUT the file it just made |

Serve the repository root and open `/glb%20files/preview.html?m=savannah.glb`.

## The thumbnail

`menu.js`, `chars.js` and `shop.js` all draw `characters/previews/character-<id>.png`,
and until Robin nothing in this pipeline made one — the four that existed had no
source. A canvas cannot save a file, so the page renders it and posts it:

```bash
node png-sink.js &           # writes under the repository and nowhere else
# then open
# /glb%20files/preview-png.html?m=robin.glb&save=../public/characters/previews/character-w.png
```

It renders at 2× and downsamples, poses the model in its **idle** a quarter of the
way in, and lights it with `chars.js`'s own three lights so the thumbnail and the
turntable beside it are not two different models. Stop the sink when you are done;
it is a write endpoint with nothing in front of it.

## Adding a clip

A Mixamo *animation* download has no mesh in it, and a Mixamo *character*
download has a two-key T-pose where a clip should be — so the two halves need
opposite tools. `fbx2glb.js` ignores animation on purpose; `fbx2clip.js` reads
nothing else.

```bash
cd "glb files"
node fbx2clip.js ../animations/rigs/Flying.fbx rig/fly.glb
for id in s t u; do
  node merge-clips.js "../public/characters/models/character-$id.glb" "/tmp/c.glb"     fly=rig/fly.glb inplace=fly
  cp /tmp/c.glb "../public/characters/models/character-$id.glb"
done
npm run bump          # ← or the browser serves yesterday's model for a day
```

**Do not skip the bump.** Models are served with `max-age=86400` and fetched with
`?v=ASSETV`; change one without moving that number and the browser keeps the old
file. `rig.play()` leaves the current clip alone when it cannot find the name, so
a character with a stale model flies in its idle pose and nothing anywhere says
why. `AVATAR.can(name)` exists to make that case audible.

The rotation is the whole job of `fbx2clip.js`: FBX stores orientation as Euler
degrees on top of a **pre-rotation** that is not animated and lives only in the
node's properties, so the quaternion that comes out is `qPre · qEuler`. Checked
against `rig/walk.glb`, which the real FBX2glTF produced from the same source —
they agree at every keyframe to within 0.04°, and the version here carries none
of the 180° sign flips the reference has between neighbouring keys.

`animations/rigs/Swimming.fbx` is converted too (`rig/swim.glb`) and merged into
nobody: there is nothing to swim in yet.

## The E-45

Robin's ship, parked beside the house on RYU. It arrives as a 2017 Blender export
with two materials, UVs and four JPEGs, and none of that survives — nothing in
this game ships a texture. What survives is the **geometry** and, crucially, the
**material names**.

```bash
cd "glb files"
node obj2glb.js "../animations/vehicles/E-45-Aircraft/E 45 Aircraft_obj.obj" /tmp/e45-raw.glb
node paint-ship.js /tmp/e45-raw.glb e45.glb '{
  "nose":"-z",
  "parts":{"Material.004":"glass"},
  "engine":0.10, "glow":0.035, "canopyZ0":9, "canopyZ1":9,
  "C":{"hull":"#c6ccd8","canopy":"#1b2447","glass":"#5b93e0",
       "engine":"#23252c","glow":"#8ff0ff"}
}'
cp e45.glb ../public/ships/e45.glb
npm run bump
```

**`nose:"-z"`.** Models do not agree about which way they face. The first ship
was authored nose-forward down `+z`; this one is the other way round, which is
already the direction the game's ships fly, so it needs no turn at load. Get it
wrong and nothing errors — the bands land on the far end and you get a plausible
aircraft painted backwards, canopy on the tail fin.

**`parts` beats bands.** `paint-ship.js` finds a canopy by asking where a
triangle sits: high up, near the centre line, forward of the wings. That rule
cannot find this one — the E-45's canopy is half the length of its fuselage and
sits at the same height as the spine either side of it, so the rule selects most
of the aircraft. But the author had `usemtl Material.004` switched on for exactly
those 744 faces in 2017, `obj2glb.js` now carries those runs through in
`meshes[0].extras.groups`, and `parts` maps the name onto a region. The canopy
stops being a guess. `canopyZ0`/`canopyZ1` are set past 1 to turn the geometric
rule off entirely, since nothing is left for it to find.

**The aerial.** Thirty-one of her twelve thousand vertices hang below the hull on
a needle, so `Box3.min.y` is a number about the wrong part of the ship: sitting
her on it parks her a metre and a half in the air. `planet.js` throws away the
lowest one per cent instead — see `restOf()` there. It is the same argument
`house.js` makes about Ion in reverse: there the extreme was real and the box was
wrong, here the box is honest and the extreme is a whisker.

## Painting by bone

`paint-rigged.js` paints in height bands, which is the right amount of
machinery for a character in one solid outfit. It cannot paint one in a crop
top: in a T-pose an arm and the chest beside it are the same slice of the same
body, so "sleeve or bare arm" is not a question a height has an answer to.

`paint-skinned.js` asks the rig instead — every vertex is weighted to the bones
that move it, so the one on the upper arm says so. Height still decides what
height genuinely decides, like where a hem crosses a torso, and it is far more
reliable once it is only ever asked about one limb at a time.

Every number in a `.paint.json` is a **fraction of the figure**, never a length:
height over height, width over the fingertip reach, depth over height. That is
what lets the same spec paint the model at any scale.

Two bands are off unless a character needs them, so nobody already painted
changes when they are added:

| | |
|---|---|
| `shortsHem` | below it the leg is BARE. The leg bones were unconditionally trousers, which paints a bare calf denim blue |
| `hatLine` | above it the head is a HAT rather than hair — a lid on the hairline, the way the hairline is a lid on the face |

Two more, added for Carlos and off by default for the same reason:

| | |
|---|---|
| `sock` | `[top, stripe]` — the band between the shoe and the leg, and how tall one stripe is. `0` for a plain sock |
| `sole` | below it the shoe is its sole. Nearly every shoe is two colours with a line across it, and a red high-top painted entirely red loses the part that says *shoe* |

**A character with no reference sheet is a character whose colours are a
guess.** Both Savannah and Carlos have one now, and both palettes were read
off the drawing rather than chosen. Where a drawing and the mesh disagree,
trust the drawing for HEIGHTS and the rig for WIDTHS: both characters'
vertical landmarks land within about a percent of their own skeletons, and
both drawings have proportionally longer arms than the model does.


## Robin, and four more bands

**Robin is not on the roster.** She is the first character a *place* puts you in
rather than one you pick: RYU casts her on everybody who lands on it
(`AVATAR.setCast`), and there is no other way to be her — not the wardrobe, not
the quick change, not the Mall. So `avatar.js` keeps two lists now. `CHARS` is
the ROSTER, who you can choose and what the shop sells; `BODIES` is everything
the game can stand up, which is the roster plus the cast-only ones. `load()` and
`setCast()` read `BODIES`; every grid, price list and picker reads `CHARS`.

She carries all nine clips rather than the six the others launched with — `swim`
is the real Mixamo one, not the front crawl `avatar.js` builds out of `fly` when
a model has not got one.

```bash
cd "glb files"
node fbx2glb.js ../animations/Robin/RobinRyu.fbx robin-rigged.glb
node paint-skinned.js robin-rigged.glb robin-painted.glb robin.paint.json
node merge-clips.js robin-painted.glb robin.glb dropbase \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb \
  jump=rig/jump.glb dance=rig/dance.glb fly=rig/fly.glb \
  swim=rig/swim.glb salsa=rig/salsa.glb flip=rig/flip.glb \
  inplace=walk,sprint,jump,dance,fly,swim,salsa,flip trim=jump:0.4166:1.2918
cp robin.glb ../public/characters/models/character-w.glb
npm run bump
```

She still needs the thumbnail, even off the roster: the dashboard draws the face
of the body you are IN rather than the one you chose, so on RYU it is hers.

**`inplace` covers `fly` and `swim` too.** Left out of it they keep Mixamo's root
motion, and a clip that also moves the hips slides the body out of the frame once
per loop — which on the clip sheet looks like a character walking off the page and
in the game looks like flying away from yourself.

Her outfit needed four things the painter could not say, all of them null or zero
by default so Savannah and Carlos come out byte for byte as before:

| | |
|---|---|
| `bands` | `[[bottom, top, colour], ...]` — a belt, a choker, a waistband. Only ever asked about the body column: in a T-pose both arms run through the height a choker sits at |
| `neckline` | above it the TORSO is bare. `collarTop` already says this for the head and the neck, and a T-shirt does not need it asked twice — an off-shoulder top does |
| `sleeveStart` | the sleeve's inner edge. Without one a strap worn off the shoulder climbs back up the trapezius to the collar |
| `watchBoth` | a watch goes on one wrist, which is why the side test exists; a pair of studded bracelets goes on two |

and `C.sleeve`, which colours the arm and shoulder separately from the body when
the two are different garments.

**Read the paint off the mesh, not off a guess.** The heights in
`robin.paint.json` came from sorting every vertex into the limb its heaviest
joint drives and reading where each limb starts and stops — boot 0.000-0.090,
torso 0.594-0.870, upper arm ax 0.307-0.597 — and then from the reference sheet
for where the clothing crosses them. Guessing a band and looking at the render is
much slower than it sounds: the first pass had the belt sitting exactly on the
bare midriff and the choker covering the entire throat, and neither is visible at
the size a character is on screen.


## Ion, and painting a machine

Ion is a robot, he is nobody's character — you cannot wear him, buy him or be
cast as him — and he lies on the floor of the second room of the house on RYU.
`house.js` loads him directly rather than through `AVATAR`, which normalises
every body to the height of a person and hands back something the Mall expects
to be able to sell.

His FBX carries the mesh **and** the clip, so the two halves come out with
opposite tools — `fbx2glb.js` ignores animation on purpose and `fbx2clip.js`
reads nothing else:

```bash
cd "glb files"
node fbx2glb.js  "../animations/Ion/Ion (beathless).fbx" ion-rigged.glb
node fbx2clip.js "../animations/Ion/Ion (beathless).fbx" rig/breathless.glb
node fbx2clip.js "../animations/rigs/Laying Seizure.fbx" rig/seizure.glb
node paint-skinned.js ion-rigged.glb ion-painted.glb ion.paint.json
node merge-clips.js ion-painted.glb ion.glb dropbase \
  breathless=rig/breathless.glb idle=rig/idle.glb seizure=rig/seizure.glb \
  inplace=breathless,seizure
cp ion.glb ../public/characters/models/ion.glb
npm run bump
```

**Three clips, and he is a robot with one animation in his own FBX.** The
other two are the generic Mixamo rig's, retargeted onto him by bone name for
nothing but the merge — `idle` is the one every person in this game stands in,
so being mended looks like standing up rather than like a robot going rigid,
and `seizure` is `animations/rigs/Laying Seizure.fbx`, which is what being
hacked looks like. `idle` drops twelve channels on the way in: bones that rig
has and he has not, which is exactly what retargeting a person onto a machine
should do and not a warning worth acting on.

Both floor clips need `inplace` and both need dropping onto the tile, by their
own amount — see *Two things that do not work on a SkinnedMesh* below. Lying
still and thrashing do not put the same part of him lowest, so `house.js`
measures the seizure across its whole five seconds and takes the lowest sample.

**A person is painted by garment and a machine is painted by part.** Every band
above — a hem, a collar, where the sleeve ends — answers *what is this vertex
wearing*, and none of those questions mean anything about Ion. He is not
dressed, he is assembled, and which colour a piece of him is IS which piece of
him it is, which the rig already knows. A spec with `LIMBS` in it takes a
separate path through `classify()` and never touches the garment rules:

```json
"LIMBS": {
  "head": "shell",
  "leg":  [[0.240, "plate"], "shell"],
  "foot": [[0.025, "joint"], "plate"]
}
```

A colour name, or a list of `[upTo, name]` steps ending in a default — because
one bone often carries two panels, like the thigh and the shin that share `leg`.
Two more came with him: `facePow`, which rounds the corners of the face oval
into the squircle a display bolted to a box actually is (2 is the ellipse
everybody already has, 8 is nearly a rectangle), and `eyes`, a pair of discs on
it.

### Measure the face, do not place it

Ion's eyes and mouth are **modelled** — discs standing proud of a recessed
panel — but only just: the whole screen sits between zN 0.165 and 0.190, so
depth cannot separate them from it. Taking the frontmost group and clustering
it by **signed x** finds them exactly, and the answer was nothing like the
guess: left eye at x −0.177 r 0.047, right at x 0.190 r 0.045, both at y 0.808.
Placed by eye at ax 0.135 they had landed half on and half off the geometry and
rendered as two cream spikes.

A disc is round when `rY / rAx` equals `xmax / H` for the model — 0.536 here.
Ion's came out at 0.565, which is how we know they are discs and not ovals.

## Two things that do not work on a SkinnedMesh

**`Box3.setFromObject` cannot see a pose.** It transforms the geometry's bounds
by `matrixWorld` and never asks the skeleton, so it hands back the BIND pose's
box however an animation has posed the model. It does not throw and it does not
return anything obviously wrong — it returns the same plausible number every
frame. Used to drop Ion onto the floor it lifted him a T-pose's worth into the
air. `house.js` asks the skin instead, through `applyBoneTransform`, which
pushes a bind-pose vertex through the skeleton exactly as the vertex shader
does.

**Mixamo keeps the hips at a standing height even in a clip that lays the body
flat**, and `inplace` only flattens the fore/aft drift. Out of the box Ion lies
down two thirds of a metre above the tile, in a pose that is otherwise perfect.
