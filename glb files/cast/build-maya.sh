#!/bin/sh
# MAYA, rebuilt from her reference art (2026-10-03): a Higgsfield Meshy 7 ultra
# body in her base layer (black crop top and shorts, barefoot), auto-rigged,
# through the cast's route with the cast's clips. What she wears over it — the
# red turtleneck, navy trousers, black boots, the lab coat, the glasses — is
# the wardrobe's (wardrobe/README.md), cut from her wearing them, so each comes
# off. Her face gets the same blendshapes as Robin's (face/morphs.js, her own
# landmarks).
#
#   sh cast/build-maya.sh        # cast/maya-raw.glb -> public/characters/models/character-maya.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/cast-maya
node retarget.js "cast/maya-raw.glb" "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb jump=rig/jump.glb \
  dance=rig/dance.glb fly=rig/fly.glb talk=rig/talk.glb talk2=rig/talk2.glb \
  walk_left=rig/walk_left.glb walk_right=rig/walk_right.glb walk_back=rig/walk_back.glb \
  sprint_left=rig/sprint_left.glb sprint_right=rig/sprint_right.glb sprint_back=rig/sprint_back.glb \
  swim=rig/swim.glb ride=rig/sit.glb salsa=rig/salsa.glb flip=rig/flip.glb \
  inplace=walk,sprint,jump,dance,fly,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,swim,ride,salsa,flip \
  floor=idle,walk,sprint,jump,dance,talk,talk2,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,salsa,flip \
  trim=jump:0.4166:1.2918
npx -y @gltf-transform/cli resize "$T-rt.glb" "$T-a.glb" --width 2048 --height 2048
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 86
node cast/fix-material.js "$T-b.glb" "$T-c.glb"
npx -y @gltf-transform/cli prune "$T-c.glb" "cast/maya.glb"
npx -y @gltf-transform/cli simplify "cast/maya.glb" "$T-s.glb" --ratio 0.32 --error 0.0008
node face/morphs.js "$T-s.glb" "$T-f.glb" face/maya.landmarks.json
npx -y @gltf-transform/cli quantize "$T-f.glb" "$T-q.glb"
npx -y @gltf-transform/cli sparse "$T-q.glb" "../public/characters/models/character-maya.glb"
