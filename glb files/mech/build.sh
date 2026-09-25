#!/bin/sh
# THE MECHAS: a Higgsfield image-to-3D (textured, auto-rigged, A-pose) to a
# mecha with the five clips mecha.gd plays — idle, walk, sprint, jump, fly.
#
#   sh mech/build.sh seraph     # mech/seraph-raw.glb -> mech/seraph.glb
#
# The same route as the cast (../cast/build.sh); only the clip list differs.
set -e
cd "$(dirname "$0")/.."
N=$1
T=${TMPDIR:-/tmp}/mech-$N
node retarget.js "mech/$N-raw.glb" "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb jump=rig/jump.glb fly=rig/fly.glb \
  inplace=walk,sprint,jump,fly floor=idle,walk,sprint,jump \
  trim=jump:0.4166:1.2918
npx -y @gltf-transform/cli resize "$T-rt.glb" "$T-a.glb" --width 2048 --height 2048
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 88
node cast/fix-material.js "$T-b.glb" "mech/$N.glb"
