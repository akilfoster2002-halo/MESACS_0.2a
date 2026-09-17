/* =====================================================================
   PRUNE — everything in a glb that nothing points at.

   TOOLS THAT REWRITE A MESH LEAVE THE OLD ONE BEHIND. weld-rigged.js
   appends the welded arrays and repoints the primitive at them;
   merge-clips.js appends the clips it was given. Neither removes what it
   replaced, because neither has to: nothing reads an accessor nobody
   points at, so the model loads, animates and looks exactly right.

   The only symptom is the download. The Mechanic came out of the welder
   at 5.0 MB from a 4.0 MB input having just had five sixths of his
   vertices removed — four of those megabytes were the mesh he used to be.
   Every character already shipped is carrying some of the same, between
   a quarter of a megabyte and one and a half.

   REACHABILITY, FROM THE THINGS THAT ARE ACTUALLY DRAWN: the meshes and
   their morph targets, the skins' bind matrices, and the animation
   samplers. An accessor no chain of those reaches is not needed by
   anybody, and neither is the view under it.

   THE VIEWS ARE REBUILT RATHER THAN PATCHED. Offsets into a buffer that
   has had holes cut in it are a class of bug not worth having: the
   survivors are copied out in order and their offsets recomputed, so a
   stale byteOffset cannot survive the operation.
   ===================================================================== */

/* Takes the parsed glTF json and the binary chunk. Returns a new
   {json, bin} with the unreachable accessors and views gone, and says
   how many it dropped. */
function prune(json, bin){
  const g = json;
  const reach = new Set();
  for(const m of (g.meshes||[])) for(const pr of (m.primitives||[])){
    for(const k in (pr.attributes||{})) reach.add(pr.attributes[k]);
    if(pr.indices!==undefined) reach.add(pr.indices);
    for(const t of (pr.targets||[])) for(const k in t) reach.add(t[k]);
  }
  for(const sk of (g.skins||[]))
    if(sk.inverseBindMatrices!==undefined) reach.add(sk.inverseBindMatrices);
  for(const an of (g.animations||[])) for(const sm of (an.samplers||[])){
    reach.add(sm.input); reach.add(sm.output);
  }

  const keepAcc = [...reach].filter(i=>g.accessors[i]).sort((a,b)=>a-b);
  const accMap = new Map(keepAcc.map((old,i)=>[old,i]));

  /* An image can own a view without owning an accessor, so those are
     carried across too or a textured model loses its pixels. */
  const keepView = [], viewMap = new Map();
  const takeView = old => {
    if(old===undefined || viewMap.has(old)) return;
    viewMap.set(old, keepView.length); keepView.push(old);
  };
  for(const old of keepAcc) takeView(g.accessors[old].bufferView);
  for(const im of (g.images||[])) takeView(im.bufferView);

  const chunks=[]; let off=0;
  const views = keepView.map(old=>{
    const bv=g.bufferViews[old];
    const start=bv.byteOffset||0;
    const slice=bin.slice(start, start+bv.byteLength);
    const out={ buffer:0, byteOffset:off, byteLength:bv.byteLength };
    if(bv.target!==undefined) out.target=bv.target;
    if(bv.byteStride!==undefined) out.byteStride=bv.byteStride;
    const pad=(4-(slice.length%4))%4;
    chunks.push(slice); if(pad) chunks.push(Buffer.alloc(pad,0));
    off += slice.length + pad;
    return out;
  });

  const accs = keepAcc.map(old=>{
    const a=Object.assign({}, g.accessors[old]);
    if(a.bufferView!==undefined) a.bufferView=viewMap.get(a.bufferView);
    return a;
  });

  const fix = i => accMap.get(i);
  for(const m of (g.meshes||[])) for(const pr of (m.primitives||[])){
    for(const k in (pr.attributes||{})) pr.attributes[k]=fix(pr.attributes[k]);
    if(pr.indices!==undefined) pr.indices=fix(pr.indices);
    for(const t of (pr.targets||[])) for(const k in t) t[k]=fix(t[k]);
  }
  for(const sk of (g.skins||[]))
    if(sk.inverseBindMatrices!==undefined) sk.inverseBindMatrices=fix(sk.inverseBindMatrices);
  for(const an of (g.animations||[])) for(const sm of (an.samplers||[])){
    sm.input=fix(sm.input); sm.output=fix(sm.output);
  }
  for(const im of (g.images||[]))
    if(im.bufferView!==undefined) im.bufferView=viewMap.get(im.bufferView);

  const dropped = g.accessors.length - accs.length;
  g.accessors=accs; g.bufferViews=views;
  const out=Buffer.concat(chunks);
  g.buffers=[{byteLength:out.length}];
  return { json:g, bin:out, dropped };
}

/* And the same thing as a file operation, for a tool that has already
   written its glb and only wants it smaller. */
function pruneFile(path){
  const fs=require('fs');
  const b=fs.readFileSync(path);
  let off=12, json=null, bin=null;
  while(off<b.length){
    const len=b.readUInt32LE(off), t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len) break;
  }
  if(!json || !bin) return { dropped:0, before:b.length, after:b.length };
  const r=prune(json, bin);
  let js=Buffer.from(JSON.stringify(r.json),'utf8');
  if(js.length%4) js=Buffer.concat([js, Buffer.alloc(4-(js.length%4), 0x20)]);
  const head=Buffer.alloc(12); head.write('glTF',0);
  head.writeUInt32LE(2,4);
  head.writeUInt32LE(12+8+js.length+8+r.bin.length,8);
  const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
  const bh=Buffer.alloc(8); bh.writeUInt32LE(r.bin.length,0); bh.writeUInt32LE(0x004E4942,4);
  const outBuf=Buffer.concat([head,jh,js,bh,r.bin]);
  fs.writeFileSync(path, outBuf);
  return { dropped:r.dropped, before:b.length, after:outBuf.length };
}

module.exports = { prune, pruneFile };

/* node prune.js a.glb b.glb ... — prunes each in place. */
if(require.main===module){
  const fs=require('fs');
  const files=process.argv.slice(2);
  if(!files.length){ console.error('usage: node prune.js <glb> [glb...]'); process.exit(1); }
  const MB=x=>(x/1048576).toFixed(2);
  for(const f of files){
    if(!fs.existsSync(f)){ console.error('missing '+f); continue; }
    const r=pruneFile(f);
    console.log(f.replace(/^.*\//,'').padEnd(22),
      r.dropped ? (r.dropped+' dead accessors  '+MB(r.before)+' -> '+MB(r.after)+' MB')
                : 'nothing to prune');
  }
}
