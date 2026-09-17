/* PEOPLE MOVE WHILE THEY TALK — and the Mechanic is a person now.

   Four minutes of Mission 8 is people talking to each other, and all of
   it used to be delivered by statues: the only thing choosing a clip was
   whether a body was walking, and nobody walks in a cutscene. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const abs  = f => path.join(__dirname, '..', f);
const bare = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');

/* A glb's clip names, without a parser: the JSON chunk is the first one. */
function clips(file){
  const b = fs.readFileSync(abs(file));
  const len = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20+len).toString('utf8'));
  return (json.animations||[]).map(a=>a.name);
}
function accessors(file){
  const b = fs.readFileSync(abs(file));
  const len = b.readUInt32LE(12);
  return JSON.parse(b.slice(20, 20+len).toString('utf8'));
}

const ROSTER = ['s','t','u','v','w'].map(c=>`public/characters/models/character-${c}.glb`);

test('every body that speaks has both talking clips', ()=>{
  /* TWO, AND THE REASON TO HAVE TWO is that one repeated across six
     consecutive lines is a loop rather than a person. */
  for(const f of ROSTER.concat(['public/characters/models/mechanic.glb'])){
    const c=clips(f);
    for(const want of ['talk','talk2'])
      assert.ok(c.includes(want), `${f.replace(/^.*\//,'')} has no '${want}' clip: ${c.join(', ')}`);
  }
});

test('adding the talking clips took nothing away', ()=>{
  /* THE FIRST ATTEMPT REBUILT THE CLIP SET FROM SCRATCH and quietly
     dropped fly, swim, salsa and flip — every character kept walking and
     idling, so nothing looked broken until somebody took off. The clips a
     character had are not a list anybody remembers; they are a list only
     the file knows. */
  const must = {
    's':['idle','walk','sprint','jump','dance','fly'],
    't':['idle','walk','sprint','jump','dance','fly'],
    'u':['idle','walk','sprint','jump','dance','fly'],
    'v':['idle','walk','sprint','jump','dance','fly','salsa','flip'],
    'w':['idle','walk','sprint','jump','dance','fly','swim','salsa','flip']
  };
  for(const c in must){
    const have=clips(`public/characters/models/character-${c}.glb`);
    for(const want of must[c])
      assert.ok(have.includes(want),
        `character-${c} lost its '${want}' clip: ${have.join(', ')}`);
  }
});

test('no character carries a mesh it no longer uses', ()=>{
  /* A TOOL THAT REWRITES A MESH LEAVES THE OLD ONE BEHIND. Welding appends
     the welded arrays and repoints the primitive; merging appends the
     clips. Neither removes what it replaced, because nothing reads an
     accessor nobody points at — the model loads, animates and looks
     exactly right, and the only symptom is the download. */
  for(const f of ROSTER.concat(['public/characters/models/mechanic.glb'])){
    const J=accessors(f);
    const reach=new Set();
    for(const m of (J.meshes||[])) for(const pr of m.primitives){
      for(const k in pr.attributes) reach.add(pr.attributes[k]);
      if(pr.indices!==undefined) reach.add(pr.indices);
    }
    for(const s of (J.skins||[])) if(s.inverseBindMatrices!==undefined) reach.add(s.inverseBindMatrices);
    for(const a of (J.animations||[])) for(const sm of a.samplers){ reach.add(sm.input); reach.add(sm.output); }
    const orphans=J.accessors.map((a,i)=>i).filter(i=>!reach.has(i));
    assert.deepStrictEqual(orphans, [],
      `${f.replace(/^.*\//,'')} carries ${orphans.length} accessors nothing points at`);
  }
});

test('SCENE says who is speaking, and alternates the two clips', ()=>{
  const scene=bare(read('public/scene.js'));
  assert.match(scene, /get speaker\(\)/, 'SCENE does not say who is speaking');
  assert.match(scene, /get playerTalking\(\)/, 'SCENE does not say when it is the player');
  assert.match(scene, /get talkClip\(\)/, 'SCENE does not pick a talking clip');
  /* By the BEAT, so the same line always animates the same way and two
     lines running never do. */
  assert.match(scene, /\(at % 2\) \? 'talk2' : 'talk'/,
    'the clip is not chosen from the beat: two lines running would animate identically');
  /* And nothing is speaking between lines, or a body gestures at a shot
     with no dialogue on it. */
  assert.match(scene, /\(b && b\.say\) \?/, 'a beat with no line still reports a speaker');
});

test('the player gestures on their own line, and only then', ()=>{
  const avatar=bare(read('public/avatar.js'));
  assert.match(avatar, /function talkClip\(\)/, 'nothing picks a talking clip for the player');
  assert.match(avatar, /SCENE\.playerTalking/, 'the player talks when somebody else is speaking');
  /* UNDER WALKING, OVER STANDING. An emote still wins, a posture still
     wins, and moving still wins — a character gesturing while they sprint
     is worse than one standing quietly. */
  assert.match(avatar, /moving \? \(running \? 'sprint' : 'walk'\)\s*\n?\s*: \(talkClip\(\) \|\| 'idle'\)/,
    'the talking clip is not sitting under moving and over idle');
  /* AND ONLY IF THE BODY HAS IT. An old cached model, or something a
     mission stands up on its own, falls back to idle rather than to
     nothing. */
  assert.match(avatar, /can\(want\) \? want :/, 'a body without the clip is asked to play it anyway');

  /* A CUTSCENE FREEZES THE WORLD, which is what a cutscene IS — so the
     thing that drives the player's clip has to run outside walk(). */
  const planet=bare(read('public/planet.js'));
  assert.match(planet, /AVATAR\.tickClip\(dt, false, false, true\)/,
    'nothing animates the player while a scene holds the world still');
  assert.match(avatar, /function tickClip\(/, 'AVATAR has no clip-only entry point');
  /* It must NOT be update(), which also poses the body for a flat room
     and would flatten the sphere pose planet.js builds. */
  const tick=planet.slice(planet.indexOf('AVATAR.tickClip'), planet.indexOf('AVATAR.tickClip')+80);
  assert.ok(!/AVATAR\.update/.test(tick), 'the planet poses the player with the flat-room updater');
});

test('an NPC gestures on its own lines, by the name it speaks under', ()=>{
  const planet=bare(read('public/planet.js'));
  /* THE PLATE AND THE DIALOGUE ARE DIFFERENT STRINGS. The nameplate says
     THE MECHANIC because it is a label; the beats say 'The Mechanic'
     because it is a person talking. Matching one to the other by folding
     case works until somebody writes a character where it does not. */
  assert.match(planet, /speaks:speaks\|\|null/, 'a person does not record the name they speak under');
  assert.match(planet, /SCENE\.speaker===f\.speaks/, 'nobody checks whether this NPC is the one talking');
  assert.match(planet, /'The Mechanic'\)/, 'the Mechanic does not say which name his lines are under');
  assert.match(planet, /'Mr Einstein'\)/, 'Mr Einstein does not say which name his lines are under');
});

test('the Mechanic is his own character, not somebody off the roster', ()=>{
  const avatar=read('public/avatar.js');
  const planet=bare(read('public/planet.js'));
  /* HE WAS CAST FROM WHOEVER THE STUDENT DID NOT PICK, which made him a
     different person every session. */
  assert.match(avatar, /id:'mechanic'/, 'there is no Mechanic body');
  assert.match(avatar, /characters\/models\/mechanic\.glb/, 'the Mechanic has no model');
  assert.match(planet, /'towermech', 'mechanic'/, 'the Mechanic is still cast off the roster');
  assert.ok(fs.existsSync(abs('public/characters/models/mechanic.glb')), 'mechanic.glb is not installed');
  assert.ok(fs.existsSync(abs('public/characters/previews/mechanic.png')), 'the Mechanic has no portrait');
  /* And that portrait is beside his lines. */
  assert.match(planet, /'The Mechanic':'characters\/previews\/mechanic\.png'/,
    'the Mechanic speaks with no face beside him');

  /* HE IS NOT ON THE ROSTER. Nobody picks him in the Mall: he is a person
     in the story, not a shirt. */
  const ids=avatar.match(/const IDS = '([a-z]+)'/);
  assert.ok(ids, 'the roster ids have been renamed');
  assert.ok(!ids[1].includes('m'), 'the Mechanic is on the pickable roster');
});

test('Ion is loaded as the prop he is', ()=>{
  /* AVATAR.load() FALLS BACK TO THE FIRST CHARACTER for an id it does not
     know, which is right for a typo and a trap for a model that exists
     and is simply not listed. `AVATAR.load('ion')` fetched Kyle, and what
     lay on the Mechanic's cradle was Kyle, face up, being called Ion by
     everybody in the room. */
  const planet=bare(read('public/planet.js'));
  const lay=planet.slice(planet.indexOf('function layIon()'), planet.indexOf('function einstein()'));
  assert.ok(!/AVATAR\.load\('ion'\)/.test(lay), "layIon asks AVATAR for a body it has not got");
  assert.match(lay, /characters\/models\/ion\.glb/, 'layIon no longer loads Ion at all');
  /* At HIS height, not a person's — he comes up to the chest of one, and
     AVATAR normalises everything it loads to a person. */
  assert.match(lay, /ION_TALL=1\.25/, 'Ion is stood up at the wrong height');
});
