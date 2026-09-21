#!/usr/bin/env node
/* =====================================================================
   ADD-CLIP — bake a Mixamo .fbx animation into a rigged .glb.

   THE RING NEEDS NO CODE TO PLAY A WALK. It looks for a clip by name in
   the costume's own `gltf.animations` and plays it while the body is
   moving; the reason the robot slid around instead was that no such clip
   was in the file. This is the thing that puts it there.

   WHY A BUILD STEP AND NOT A LOADER. The animations are Mixamo .fbx,
   which the browser cannot read — the bundled three has GLTFLoader and
   nothing else — and each one is about two megabytes of skinned mesh we
   already have. Converting once, offline, costs a lab machine nothing at
   run time and keeps the .fbx out of public/ entirely.

   WHAT RETARGETING MEANS HERE: almost nothing, and that is the luck of
   it. Both the robot .glb and the .fbx are Mixamo rigs with the same
   bone names, so a track called `mixamorigLeftArm.quaternion` belongs on
   the node called `mixamorig:LeftArm` and there is no mapping to guess
   at. FBXLoader strips the colon; putting it back is the whole of it.

   THE TWO THINGS THAT ARE NOT FREE:

     SCALE. These exports are authored in centimetres. The .glb carries
     that as a RootNode scaled by 100 with every bone translation stored
     a hundredth of its real size, and FBXLoader hands back metres — so a
     hips track lands a hundred times too high unless it is divided back
     down. It is checked rather than assumed: the scale is read off the
     RootNode, and a file that does not agree is refused.

     ROOT MOTION. "Standard Walk" travels nearly a metre forward per
     cycle, and in this game the PROGRAM moves the robot — `change x by`
     is the whole of stage one. A clip that also walks itself forward
     fights the thing the student wrote and slides the body off its own
     feet. So the horizontal travel is flattened out and the vertical bob
     is kept, which is what makes it a walk rather than a glide.

   Only the hips carry a position track at all. Every other bone's
   translation is its bone LENGTH, and copying those between two
   differently-proportioned robots is how you get a body that comes apart.

     node tools/add-clip.js <clip.fbx> <name> <target.glb> [more.glb...]
   ===================================================================== */
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import fs from 'node:fs';
import path from 'node:path';

const [,, fbxPath, clipName, ...targets] = process.argv;
if(!fbxPath || !clipName || !targets.length){
  console.error('usage: node tools/add-clip.js <clip.fbx> <name> <target.glb> [...]');
  process.exit(1);
}

/* ------------------------------------------------------------ the GLB */
const GLB_MAGIC=0x46546C67, JSON_CHUNK=0x4E4F534A, BIN_CHUNK=0x004E4942;
function readGLB(file){
  const b=fs.readFileSync(file);
  if(b.readUInt32LE(0)!==GLB_MAGIC) throw new Error(file+' is not a .glb');
  let off=12, json=null, bin=null;
  while(off < b.length){
    const len=b.readUInt32LE(off), type=b.readUInt32LE(off+4);
    const body=b.slice(off+8, off+8+len);
    if(type===JSON_CHUNK) json=JSON.parse(body.toString('utf8'));
    else if(type===BIN_CHUNK) bin=body;
    off += 8 + len + ((4 - len%4) % 4);
  }
  if(!json) throw new Error(file+' has no JSON chunk');
  return { json, bin: bin || Buffer.alloc(0) };
}
const pad4 = n => (4 - n%4) % 4;
function writeGLB(file, json, bin){
  const j=Buffer.from(JSON.stringify(json),'utf8');
  const jp=Buffer.concat([j, Buffer.alloc(pad4(j.length), 0x20)]);   // JSON pads with spaces
  const bp=Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0)]);  // BIN pads with zeroes
  const total=12 + 8+jp.length + (bp.length? 8+bp.length : 0);
  const out=Buffer.alloc(total);
  out.writeUInt32LE(GLB_MAGIC,0); out.writeUInt32LE(2,4); out.writeUInt32LE(total,8);
  let o=12;
  out.writeUInt32LE(jp.length,o); out.writeUInt32LE(JSON_CHUNK,o+4); jp.copy(out,o+8); o+=8+jp.length;
  if(bp.length){ out.writeUInt32LE(bp.length,o); out.writeUInt32LE(BIN_CHUNK,o+4); bp.copy(out,o+8); }
  fs.writeFileSync(file, out);
  return total;
}

/* ------------------------------------------------------------ the FBX */
function readClip(file){
  const buf=fs.readFileSync(file);
  const ab=buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength);
  const obj=new FBXLoader().parse(ab, path.dirname(file)+'/');
  if(!obj.animations || !obj.animations.length) throw new Error(file+' carries no animation');
  return obj.animations[0];
}
/* mixamorigLeftArm  ->  mixamorig:LeftArm */
const boneOf = track => {
  const raw=track.name.split('.')[0];
  return raw.startsWith('mixamorig') && raw[9]!==':'
    ? 'mixamorig:'+raw.slice(9) : raw;
};
const propOf = track => track.name.split('.').pop();

/* ------------------------------------------------------------- baking */
function bake(glbFile, clip){
  const { json, bin } = readGLB(glbFile);
  const nodes = json.nodes || [];
  const index = new Map(nodes.map((n,i)=>[n.name, i]));

  /* THE SCALE IS READ, NOT ASSUMED. */
  const root = nodes.find(n=>n.name==='RootNode');
  const s = root && root.scale ? root.scale[0] : 1;
  if(!(s>0)) throw new Error(glbFile+': RootNode has no usable scale');
  if(Math.abs(s-100) > 1 && Math.abs(s-1) > 0.001)
    throw new Error(glbFile+': unexpected root scale '+s+' — check the units before baking');

  json.animations = json.animations || [];
  json.accessors  = json.accessors  || [];
  json.bufferViews= json.bufferViews|| [];
  const chunks=[bin];
  let at=bin.length;

  const addView = buf => {
    const padding=pad4(at);
    if(padding){ chunks.push(Buffer.alloc(padding,0)); at+=padding; }
    chunks.push(buf);
    json.bufferViews.push({ buffer:0, byteOffset:at, byteLength:buf.length });
    at += buf.length;
    return json.bufferViews.length-1;
  };
  const addAccessor = (arr, type, comps) => {
    const buf=Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const min=new Array(comps).fill(Infinity), max=new Array(comps).fill(-Infinity);
    for(let i=0;i<arr.length;i++){ const k=i%comps;
      if(arr[i]<min[k]) min[k]=arr[i];
      if(arr[i]>max[k]) max[k]=arr[i]; }
    json.accessors.push({ bufferView:addView(buf), componentType:5126,
      count:arr.length/comps, type, min, max });
    return json.accessors.length-1;
  };

  /* Mixamo gives every track the same key times, so one input accessor
     serves the whole clip rather than forty copies of the same list. */
  const times=Float32Array.from(clip.tracks[0].times);
  const sameTimes = clip.tracks.every(t=>t.times.length===times.length);
  const sharedIn = sameTimes ? addAccessor(times, 'SCALAR', 1) : -1;

  const samplers=[], channels=[];
  let used=0, skipped=[];
  clip.tracks.forEach(track=>{
    const bone=boneOf(track), prop=propOf(track);
    const node=index.get(bone);
    if(node===undefined){ skipped.push(bone); return; }
    /* Only the hips are allowed to move. Every other bone's translation
       is its LENGTH, and copying those between two robots of different
       proportions takes the body apart. */
    if(prop==='position' && !/Hips$/.test(bone)) return;
    if(prop!=='position' && prop!=='quaternion') return;

    let values, type;
    if(prop==='position'){
      type='VEC3';
      const v=Float32Array.from(track.values);
      /* flatten the travel, keep the bob: the program does the walking */
      let x0=v[0], z0=v[2];
      for(let i=0;i<v.length;i+=3){ v[i]=x0; v[i+2]=z0; }
      for(let i=0;i<v.length;i++) v[i] /= s;      // metres -> the file's units
      values=v;
    } else {
      type='VEC4';
      values=Float32Array.from(track.values);
    }
    const input = sharedIn>=0 ? sharedIn : addAccessor(Float32Array.from(track.times),'SCALAR',1);
    samplers.push({ input, output:addAccessor(values, type, prop==='position'?3:4),
                    interpolation:'LINEAR' });
    channels.push({ sampler:samplers.length-1,
                    target:{ node, path: prop==='position' ? 'translation' : 'rotation' } });
    used++;
  });

  json.animations = json.animations.filter(a=>a.name!==clipName);   // re-runnable
  json.animations.push({ name:clipName, samplers, channels });

  const merged=Buffer.concat(chunks);
  json.buffers=[{ byteLength: merged.length }];
  const size=writeGLB(glbFile, json, merged);
  return { used, skipped:[...new Set(skipped)], keys:times.length,
           secs:clip.duration, mb:(size/1048576).toFixed(2) };
}

const clip=readClip(fbxPath);
console.log(`"${path.basename(fbxPath)}" — ${clip.duration.toFixed(2)}s, ${clip.tracks.length} tracks`);
targets.forEach(t=>{
  const r=bake(t, clip);
  console.log(`  ${path.basename(t)}: ${r.used} tracks baked as "${clipName}"` +
    `, ${r.keys} keys, ${r.secs.toFixed(2)}s -> ${r.mb}MB` +
    (r.skipped.length ? `  (no such bone: ${r.skipped.length})` : ''));
});
