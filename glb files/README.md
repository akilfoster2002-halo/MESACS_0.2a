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
