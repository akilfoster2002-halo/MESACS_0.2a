#!/bin/sh
# ROBIN WITH HER GUITAR (TSH, the song in her room): Mixamo's two guitar-playing clips (animations/guitar, through
# fbx2clip.js into rig/guitar) on Robin's own skeleton, clips only — the Godot port merges them into her body.
#   sh cast/build-robin-guitar.sh     # cast/robin-raw.glb -> koro-godot/assets/tsh/robin_guitar.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/robin-guitar
node retarget.js cast/robin-raw.glb "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb guitar_a=rig/guitar/guitar_a.glb guitar_b=rig/guitar/guitar_b.glb floor=idle,guitar_a,guitar_b
node clips-only.js "$T-rt.glb" "$T-a.glb"
npx -y @gltf-transform/cli prune "$T-a.glb" "$T-b.glb"
npx -y @gltf-transform/cli resample "$T-b.glb" "$T-c.glb"
cp "$T-c.glb" ../koro-godot/assets/tsh/robin_guitar.glb
rm -f "$T"-*.glb
