#!/bin/sh
# ROBIN'S MOVES (TSH, the fight in Dragon Alley): Mixamo's punches, kicks,
# dodges and falls (rig/fight) on Robin's own Higgsfield skeleton — and then
# only the clips, with her mesh and textures taken out (clips-only.js), so the
# fight adds them to the body the game already has (avatar.js rig.add) and no
# other room pays for them. About 850 KB. Her ways out of a swing, all Mixamo,
# trimmed to the move and held in place (the fight moves her itself): `cartL` and
# `cartR`, a cartwheel leading with the left hand and with the right (the second
# is Mixamo's mirror of the first), `bflip` a backflip, `wallkick` the push off a
# wall, and `evroll` her roll again under the fight's own name, so the fight can
# play it at its own speed without changing the shoes' landings.
#
#   sh cast/build-robin-fight.sh     # cast/robin-raw.glb -> public/characters/fight/robin.glb
set -e
cd "$(dirname "$0")/.."
T=${TMPDIR:-/tmp}/robin-fight
F=rig/fight
node retarget.js cast/robin-raw.glb "$T-rt.glb" higgsfield.map.json ref=rig/idle.glb \
  idle=rig/idle.glb fight=$F/bouncingfightidle.glb jab=$F/punching.glb cross=$F/crosspunch.glb hook=$F/hookpunch.glb kick=$F/roundhousekick.glb \
  knee=$F/kneekicklead.glb elbow=$F/elbowpunch.glb power=$F/hookpunch1.glb dodge=$F/dodging.glb block=$F/block.glb \
  hit=$F/receiveuppercuttotheface.glb stagger=$F/takingpunch.glb fall=$F/sweepfall.glb getup=$F/crouchtostand.glb ko=$F/dying.glb \
  flykick=$F/flyingkick.glb sweep=$F/legsweep.glb spin=$F/hurricanekick.glb boxing=$F/boxing.glb \
  cartL=$F/cartwheel.glb cartR=$F/cartwheel-mirror.glb bflip=$F/backflip.glb wallkick=$F/jumpfromwall.glb evroll=rig/roll.glb \
  trim=cartL:0.85:2.75 trim=cartR:0.80:2.70 trim=bflip:0.95:2.65 trim=wallkick:0.30:1.27 inplace=cartL,cartR,bflip,wallkick,evroll \
  floor=idle,fight,jab,cross,hook,kick,knee,elbow,power,dodge,block,hit,stagger,boxing
node clips-only.js "$T-rt.glb" "$T-a.glb"
npx -y @gltf-transform/cli prune "$T-a.glb" "$T-b.glb"
npx -y @gltf-transform/cli resample "$T-b.glb" "$T-c.glb"
mkdir -p ../public/characters/fight
cp "$T-c.glb" ../public/characters/fight/robin.glb
rm -f "$T"-*.glb
