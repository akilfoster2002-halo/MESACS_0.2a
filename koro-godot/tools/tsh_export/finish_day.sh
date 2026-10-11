#!/bin/sh
# After export_day.js: shrink the textures, undo the mesh quantization Godot cannot read, people into people/
set -e
cd "$(dirname "$0")/../../assets/tsh"
for f in school sub apt people_guard people_teacher people_t people_u people_x people_nia people_zuri; do
  npx -y @gltf-transform/cli webp $f.glb /tmp/$f-a.glb --quality 88 >/dev/null
  npx -y @gltf-transform/cli prune /tmp/$f-a.glb /tmp/$f-b.glb --keep-leaves true >/dev/null
  npx -y @gltf-transform/cli dequantize /tmp/$f-b.glb $f.glb >/dev/null
  ls -la $f.glb
done
# GPU instancing (the school's chairs, lockers…) baked out into plain nodes: a script beside the gltf-transform npx installed
N=$(dirname "$(ls -d ~/.npm/_npx/*/node_modules/@gltf-transform/functions | head -1)")/..
cp ../../tools/tsh_export/uninstance.mjs "$N/../uninstance.mjs"
for f in school sub apt; do node "$N/../uninstance.mjs" $f.glb /tmp/$f-u.glb && mv /tmp/$f-u.glb $f.glb; done
rm -f "$N/../uninstance.mjs"
for f in people_*.glb; do mv "$f" "people/${f#people_}"; done
rm -f school.glb.import sub.glb.import apt.glb.import people/*.glb.import school_*.png school_*.png.import sub_*.png sub_*.png.import apt_*.png apt_*.png.import apt_*.webp apt_*.webp.import
