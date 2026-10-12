#!/bin/sh
# ROBIN ON THE PHONE (TSH): Mixamo's phone clips (animations/talk on phone, through fbx2clip.js into rig/phone)
# on Robin's own skeleton, clips only — the Godot port merges them into her body as it does her fight moves.
#   phone_talk  standing, the phone at her ear, talking        phone_pace  walking to and fro on the phone
#   phone_cell  on a cell phone, the other hand going           talk_hands  talking, hands going, no phone
#
#   sh cast/build-robin-phone.sh     # cast/robin-raw.glb -> koro-godot/assets/tsh/robin_phone.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/robin-phone
P=rig/phone
node retarget.js cast/robin-raw.glb "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb phone_talk=$P/phone_talk.glb phone_pace=$P/phone_pace.glb phone_cell=$P/phone_cell.glb talk_hands=$P/talk_hands.glb \
  inplace=phone_pace floor=idle,phone_talk,phone_pace,phone_cell,talk_hands
node clips-only.js "$T-rt.glb" "$T-a.glb"
npx -y @gltf-transform/cli prune "$T-a.glb" "$T-b.glb"
npx -y @gltf-transform/cli resample "$T-b.glb" "$T-c.glb"
cp "$T-c.glb" ../koro-godot/assets/tsh/robin_phone.glb
rm -f "$T"-*.glb
