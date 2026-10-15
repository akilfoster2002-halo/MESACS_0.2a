#!/bin/sh
# ROBIN'S DASH (TSH, G in a fight): Mixamo's "Run" (animations/dash, through fbx2clip.js into rig/dash) on Robin's own
# skeleton, clips only — the Godot port merges it into her body.
#   sh cast/build-robin-dash.sh     # cast/robin-raw.glb -> koro-godot/assets/tsh/robin_dash.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/robin-dash
node retarget.js cast/robin-raw.glb "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb dash=rig/dash/dash.glb floor=idle,dash
node clips-only.js "$T-rt.glb" "$T-a.glb"
npx -y @gltf-transform/cli prune "$T-a.glb" "$T-b.glb"
npx -y @gltf-transform/cli resample "$T-b.glb" "$T-c.glb"
cp "$T-c.glb" ../koro-godot/assets/tsh/robin_dash.glb
rm -f "$T"-*.glb
