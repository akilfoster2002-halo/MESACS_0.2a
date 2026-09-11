/* FLYING.

   Three things had to be true at once and none of them is checkable by
   looking at a screenshot for two seconds:

   THE CLIP HAS TO BE IN THE CHARACTER. Mixamo's Flying.fbx is an
   animation with no mesh in it, which nothing in this repo could read
   until fbx2clip.js — fbx2glb.js deliberately ignores animation, because
   a character export's "clip" is a two-key T-pose. A character without it
   flies across a planet running on nothing.

   THE CEILING HAS TO EXIST PER WORLD. VOLTA is a quarter the size of KORO
   on purpose; one ceiling for the game would put you above it like a
   marble.

   AND R HAS TO STILL MEAN SOMETHING. It used to get you into the car —
   the only thing there was to get into. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const roster = () => read('public/avatar.js')
  .match(/const IDS\s*=\s*'([a-z]+)'\.split/)[1].split('');

function gltf(id){
  const b = fs.readFileSync(path.join(__dirname,'..',
    'public/characters/models/character-'+id+'.glb'));
  let off=12, json=null;
  while(off < b.length){
    const len=b.readUInt32LE(off), type=b.readUInt32LE(off+4);
    if(type===0x4E4F534A) json=JSON.parse(b.slice(off+8, off+8+len).toString('utf8'));
    off += 8+len;
    if(!len) break;
  }
  return json;
}

test('everybody in the cast can fly', ()=>{
  for(const id of roster()){
    const g = gltf(id);
    const fly = (g.animations||[]).find(a=>a.name==='fly');
    assert.ok(fly, `character-${id}.glb has no 'fly' clip`);
    /* A clip with one key is a pose. The flight animation is a loop, and
       a loop that does not move is a character hanging in the air. */
    const t = g.accessors[fly.samplers[0].input];
    assert.ok(t.count >= 8, `the 'fly' clip on character-${id} has ${t.count} keys`);
    assert.ok(t.max[0] > 0.5, `the 'fly' clip on character-${id} lasts ${t.max[0]}s`);
  }
});

test('every world says how high you may fly over it', ()=>{
  const src = read('public/planet.js');
  /* Read the ceilings back out of the world table rather than trusting a
     count: a world that quietly lost its number falls back to 100, which
     on VOLTA is twice the radius of the place. */
  const ceilings = [...src.matchAll(/ceiling:\s*(\d+)/g)].map(m=>+m[1]);
  assert.ok(ceilings.length >= 3,
    `only ${ceilings.length} worlds carry a ceiling; there are three`);
  for(const c of ceilings) assert.ok(c > 10 && c < 400, `${c} is not a flying height`);
  /* VOLTA is the small one and has to have the smallest sky, or you climb
     out of the world it was built to show you. */
  assert.ok(Math.min(...ceilings) < Math.max(...ceilings),
    'every world has the same ceiling — then it is not a per-world number');
});

test('R asks how you travel, and the panel takes the keyboard', ()=>{
  const game = read('public/game.js');
  assert.match(game, /e\.code==='KeyR'[\s\S]{0,160}PLANET\.travel\(\)/,
    'R no longer opens the travel panel');
  assert.doesNotMatch(game, /e\.code==='KeyR'[\s\S]{0,120}PLANET\.toggleRide\(\)/,
    'R still gets straight into the car, so flying is unreachable');
  assert.match(game, /PLANET\.travelUp && PLANET\.travelKey\(e\)/,
    'the panel no longer takes the keyboard while it is up');
  assert.match(game, /function frozen\(\)[\s\S]{0,600}PLANET\.travelUp/,
    'the world no longer holds still while the panel is up');
  const html = read('public/index.html');
  for(const id of ['travel','travelRow','travelTitle','travelHint'])
    assert.ok(html.includes('id="'+id+'"'), `the page has no #${id}`);
});

test('flight is its own way of moving, and it ends', ()=>{
  const src = read('public/planet.js');
  assert.match(src, /function fly\(dt, up\)/, 'there is no flight step');
  assert.match(src, /if\(flying\) return fly\(dt, up\)/,
    'walk() no longer hands over to flight');
  /* The posture outranks the legs while you are up there, and has to be
     taken off again — it lives on AVATAR and would otherwise follow you
     into a building and outrank every walk in it. */
  assert.match(src, /function land\(\)[\s\S]{0,400}AVATAR\.posture\(null\)/,
    'landing no longer takes the flying posture off');
  assert.match(src, /function leave\(\)[\s\S]{0,600}AVATAR\.posture\(null\)/,
    'leaving the planet no longer takes the flying posture off');
  assert.match(src, /if\(blocked\(want\)\) me\.air=0/,
    'flight no longer checks buildings — you can fly through Mission Control');
  const avatar = read('public/avatar.js');
  assert.match(avatar, /posture\s*\|\|/, 'clipFor no longer honours a posture');
});
