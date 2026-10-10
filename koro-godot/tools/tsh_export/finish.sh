#!/bin/sh
# After export.js: shrink the textures, and undo the mesh quantization Godot cannot read (KHR_mesh_quantization)
set -e
cd "$(dirname "$0")/../../assets/tsh"
for f in city robin maya; do
  npx -y @gltf-transform/cli webp $f.glb /tmp/$f-a.glb --quality 88 >/dev/null
  npx -y @gltf-transform/cli prune /tmp/$f-a.glb /tmp/$f-b.glb >/dev/null
  npx -y @gltf-transform/cli dequantize /tmp/$f-b.glb $f.glb >/dev/null
  ls -la $f.glb
done
cp ../../../public/tsh/maya/mecharm.glb /tmp/mecharm.glb && npx -y @gltf-transform/cli dequantize /tmp/mecharm.glb mecharm.glb >/dev/null
rm -f *.glb.import        # Godot re-imports them on the next open
