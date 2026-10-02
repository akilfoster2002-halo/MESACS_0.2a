#!/bin/sh
# a lab garment, made small enough to ship: welded, about half the triangles
# (its edges kept where they are), maps to 2048 WebP, quantized.
#   sh shrink.sh work/x-jacket.glb ../../public/characters/wardrobe/tech-jacket/robin.glb [ratio]
set -e
T=${TMPDIR:-/tmp}/shrink-$$
G(){ npx -y @gltf-transform/cli "$@" 2>&1 | grep -v -i "deprecat\|trace-dep" | tail -1; }
G weld "$1" "$T-a.glb"
G simplify "$T-a.glb" "$T-b.glb" --ratio "${3:-0.45}" --error 0.0006 --lock-border true
G resize "$T-b.glb" "$T-c.glb" --width 2048 --height 2048
G webp "$T-c.glb" "$T-d.glb" --quality 85
G quantize "$T-d.glb" "$2"
rm -f "$T"-*.glb
