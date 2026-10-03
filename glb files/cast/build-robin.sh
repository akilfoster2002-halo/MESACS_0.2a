#!/bin/sh
# ROBIN, rebuilt from her reference photos (wardrobe/README.md): a Higgsfield
# Meshy 7 ultra body in her base outfit, auto-rigged, through the cast's route
# (build.sh) with every clip the old Robin had — the cast's eighteen plus the
# story's own: the four wall climbs, sleep and wake, text, kneel, roll.
#
#   sh cast/build-robin.sh        # cast/robin-raw.glb -> cast/robin.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/cast-robin
node retarget.js "cast/robin-raw.glb" "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb walk=rig/walk.glb sprint=rig/run.glb jump=rig/jump.glb \
  dance=rig/dance.glb fly=rig/fly.glb talk=rig/talk.glb talk2=rig/talk2.glb \
  walk_left=rig/walk_left.glb walk_right=rig/walk_right.glb walk_back=rig/walk_back.glb \
  sprint_left=rig/sprint_left.glb sprint_right=rig/sprint_right.glb sprint_back=rig/sprint_back.glb \
  swim=rig/swim.glb ride=rig/sit.glb salsa=rig/salsa.glb flip=rig/flip.glb \
  climb_up=rig/climb_up.glb climb_down=rig/climb_down.glb climb_start=rig/climb_start.glb climb_top=rig/climb_top.glb \
  sleep=rig/sleep.glb wake=rig/wake.glb text=rig/text.glb kneel=rig/kneel.glb roll=rig/roll.glb \
  inplace=walk,sprint,jump,dance,fly,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,swim,ride,salsa,flip,climb_up,climb_down,climb_start,climb_top,roll \
  floor=idle,walk,sprint,jump,dance,talk,talk2,walk_left,walk_right,walk_back,sprint_left,sprint_right,sprint_back,salsa,flip,text,kneel \
  trim=jump:0.4166:1.2918
# three 4K maps down to two 2048 WebPs (colour and normal; no metal map: she is matte)
npx -y @gltf-transform/cli resize "$T-rt.glb" "$T-a.glb" --width 2048 --height 2048
npx -y @gltf-transform/cli webp "$T-a.glb" "$T-b.glb" --quality 86
node cast/fix-material.js "$T-b.glb" "$T-c.glb"
npx -y @gltf-transform/cli prune "$T-c.glb" "cast/robin.glb"
# 70k triangles is a lot of one person for a phone: about half of them, then quantized,
# and that is the game's Robin
npx -y @gltf-transform/cli simplify "cast/robin.glb" "$T-s.glb" --ratio 0.55 --error 0.0008
# her face: blendshapes carried over from a facial rig (face/morphs.js; it reads face/rig-test.glb, the
# Sketchfab "Facial Rig test." by bayuitra, CC-BY 4.0) — then quantized with the rest of her, and only the
# vertices each shape moves kept (sparse), so seven shapes cost about 40 KB
node face/morphs.js "$T-s.glb" "$T-f.glb"
npx -y @gltf-transform/cli quantize "$T-f.glb" "$T-q.glb"
npx -y @gltf-transform/cli sparse "$T-q.glb" "../public/characters/models/character-robin.glb"
# her roster card: node wardrobe/lab.mjs card ../public/characters/models/character-robin.glb ../public/characters/previews/character-robin.png
