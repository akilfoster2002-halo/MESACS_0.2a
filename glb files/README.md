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

Serve the repository root and open `/glb%20files/preview.html?m=savannah.glb`.

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
