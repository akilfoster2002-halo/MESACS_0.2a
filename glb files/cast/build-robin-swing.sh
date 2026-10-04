#!/bin/sh
# ROBIN ON A WEB (TSH: the shoes' swing, boots.js): Mixamo's rope swings, swing-to-lands and the superhero
# landing on Robin's own Higgsfield skeleton — and then only the clips, mesh and textures taken out
# (clips-only.js), so the street adds them to the body the game already has (avatar.js rig.add). Held in
# place: the swing moves her itself (boots.js hangs her from her hand along the web).
#
#   sh cast/build-robin-swing.sh     # cast/robin-raw.glb -> public/characters/swing/robin.glb
#
# The source clips (rig/swing/*.glb) came from Mixamo through the mixamo MCP, in place, as FBX, then
# `node fbx2clip.js x.fbx rig/swing/x.glb`.
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/robin-swing
S=rig/swing
# web_swing  the swing itself (Mixamo "Swinging" up to the tuck), scrubbed by where she is on the arc
# web_flip   the tuck and flip it ends in: the release in the gold
# web_start  "Start Swinging" from the crouch: the leap into the first web off the street
# hard_land  "Hard Landing": the superhero landing, a knee and a hand down, and up
CLIPS="web_swing=$S/swing.glb web_flip=$S/swing.glb web_start=$S/swing_start.glb hard_land=$S/hard_land.glb"
EXTRA="trim=web_swing:0:0.75 trim=web_flip:0.72:1.97 trim=web_start:0.35:1.6 trim=hard_land:0:1.7 inplace=web_swing,web_flip,web_start,hard_land"
node retarget.js cast/robin-raw.glb "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb idle=rig/idle.glb $CLIPS $EXTRA
node clips-only.js "$T-rt.glb" "$T-a.glb"
npx -y @gltf-transform/cli prune "$T-a.glb" "$T-b.glb"
npx -y @gltf-transform/cli resample "$T-b.glb" "$T-c.glb"
mkdir -p ../public/characters/swing
cp "$T-c.glb" ../public/characters/swing/robin.glb
rm -f "$T"-*.glb
