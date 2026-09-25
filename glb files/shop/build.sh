#!/bin/sh
# THE GARAGE'S PROPS: a Higgsfield image-to-3D (textured, no rig) to a prop
# the Mechanic stands in its room — 1024 WebP texture, and the same material
# fix as the cast (no full-strength emissive, metallic 0).
#
#   sh shop/build.sh chest      # shop/chest-raw.glb -> koro-godot/assets/shop/chest.glb
set -e
cd "$(dirname "$0")/.."
N=$1
T=${TMPDIR:-/tmp}/shop-$N
npx -y @gltf-transform/cli resize "shop/$N-raw.glb" "$T-a.glb" --width 1024 --height 1024
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 85
node cast/fix-material.js "$T-b.glb" "../koro-godot/assets/shop/$N.glb"
