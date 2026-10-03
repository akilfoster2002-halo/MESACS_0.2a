#!/bin/sh
# THE BUYER'S CREW (TSH, Dragon Alley): a Higgsfield Meshy 7 body, auto-rigged,
# through the cast's route (build.sh) with what a man in a street fight needs —
# a walk to circle in, the punches, the hits and the falls (rig/fight, Mixamo).
# Extras, so smaller than Robin: 1024 maps, about two fifths of the triangles.
#
#   sh cast/build-thug.sh buyer      # cast/thug-buyer-raw.glb -> public/characters/models/character-thug-buyer.glb
set -e
cd "$(dirname "$0")/.."
N=thug-$1
T=${TMPDIR:-/tmp}/cast-$N
F=rig/fight
node retarget.js "cast/$N-raw.glb" "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb talk=rig/talk.glb talk2=rig/talk2.glb \
  walk_left=rig/walk_left.glb walk_right=rig/walk_right.glb walk_back=rig/walk_back.glb \
  fight=$F/bouncingfightidle.glb jab=$F/punching.glb cross=$F/crosspunch.glb hook=$F/hookpunch.glb kick=$F/kicking1.glb \
  block=$F/block.glb hit=$F/receiveuppercuttotheface.glb stagger=$F/takingpunch.glb fall=$F/sweepfall.glb \
  getup=$F/crouchtostand.glb ko=$F/dying.glb roar=$F/mutantroaring.glb \
  inplace=walk,sprint,walk_left,walk_right,walk_back \
  floor=idle,walk,sprint,talk,talk2,walk_left,walk_right,walk_back,fight,jab,cross,hook,kick,block,hit,stagger,roar
npx -y @gltf-transform/cli resize "$T-rt.glb" "$T-a.glb" --width 1024 --height 1024
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 84
node cast/fix-material.js "$T-b.glb" "$T-c.glb"
npx -y @gltf-transform/cli prune "$T-c.glb" "$T-d.glb"
npx -y @gltf-transform/cli simplify "$T-d.glb" "$T-e.glb" --ratio 0.4 --error 0.001
# a face: his landmarks found from Robin's (face/autolandmarks.js), the rig's shapes bent onto them (face/morphs.js)
node face/autolandmarks.js "$T-e.glb" "face/$N.landmarks.json" face/robin-ref.glb face/robin.landmarks.json
node face/morphs.js "$T-e.glb" "$T-f.glb" "face/$N.landmarks.json"
# quantized, and NOT made sparse (gltf-transform sparse writes these shapes as zeros: see build-robin.sh)
npx -y @gltf-transform/cli quantize "$T-f.glb" "../public/characters/models/character-$N.glb"
rm -f "$T"-*.glb
