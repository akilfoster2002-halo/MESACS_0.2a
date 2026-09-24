#!/bin/sh
# THE CAST: Nia, Sable, Kofi, Theo and Zuri, from a Higgsfield image-to-3D
# (textured, auto-rigged, A-pose) to a game character with every clip.
#
#   sh cast/build.sh nia        # cast/nia-raw.glb -> cast/nia.glb
#
# See ../README.md, "From Higgsfield instead of Mixamo", for why retarget.js
# and not merge-clips.js. ride and swim are not floored (the panda and the
# water place them), and fly is meant to be airborne.
set -e
cd "$(dirname "$0")/.."
N=$1
T=${TMPDIR:-/tmp}/cast-$N
node retarget.js "cast/$N-raw.glb" "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb jump=rig/jump.glb \
  dance=rig/dance.glb fly=rig/fly.glb talk=rig/talk.glb talk2=rig/talk2.glb \
  walk_left=rig/walk_left.glb walk_right=rig/walk_right.glb walk_back=rig/walk_back.glb \
  sprint_left=rig/sprint_left.glb sprint_right=rig/sprint_right.glb sprint_back=rig/sprint_back.glb \
  swim=rig/swim.glb ride=rig/sit.glb salsa=rig/salsa.glb flip=rig/flip.glb \
  inplace=walk,sprint,jump,dance,fly,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,swim,ride,salsa,flip \
  floor=idle,walk,sprint,jump,dance,talk,talk2,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,salsa,flip \
  trim=jump:0.4166:1.2918
# an 8 MB PNG texture down to a 2048 WebP (Godot reads EXT_texture_webp);
# no quantize — the Godot copies stay plain float meshes
npx -y @gltf-transform/cli resize "$T-rt.glb" "$T-a.glb" --width 2048 --height 2048
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 88
node cast/fix-material.js "$T-b.glb" "cast/$N.glb"
