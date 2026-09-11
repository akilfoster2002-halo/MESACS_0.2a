/* Vertex colours from geometry alone — no UVs, no unwrap, no texture.

   TWO THINGS MAKE THIS READ AS CLOTHING RATHER THAN A STAIN.

   The part is decided per TRIANGLE, from its centroid, not per vertex.
   Colouring vertices leaves every boundary triangle with one navy corner
   and one skin corner, and the GPU obligingly blends between them — so a
   sleeve becomes a four-inch gradient. Deciding per face and splitting
   the vertices along the seam gives an edge you could cut yourself on,
   which is what a garment has.

   Only boundary vertices are duplicated. A vertex used by faces that all
   agree stays single, so the mesh grows by the seams and not by a third. */
const fs=require('fs');
const {readGLB,readAccessor}=require('/tmp/glb.js');
const IN=process.argv[2], OUT=process.argv[3];
const O=JSON.parse(process.argv[4]||'{}');

const B={ shoe:0.095, jeans:0.500, torso:0.800, neck:0.832, hair:0.900,
          sleeve:0.500, faceZ:0.0, faceX:0.16, neckX:0.105, ...O };
const C={ skin:'#b07a52', hair:'#241a16', jersey:'#202b4d',
          jeans:'#3b3e44', shoe:'#efefef', ...(O.C||{}) };
const rgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];

const {json:g,bin}=readGLB(IN);
const p=g.meshes[0].primitives[0];
const P=readAccessor(g,bin,p.attributes.POSITION);
const N=readAccessor(g,bin,p.attributes.NORMAL);
const I=readAccessor(g,bin,p.indices);
const nv=P.length/3;

let ymin=Infinity,ymax=-Infinity,xmax=0;
for(let i=0;i<nv;i++){const y=P[i*3+1]; if(y<ymin)ymin=y; if(y>ymax)ymax=y;
  const ax=Math.abs(P[i*3]); if(ax>xmax)xmax=ax;}

function classify(x,y,z){
  const yN=(y-ymin)/(ymax-ymin), ax=Math.abs(x)/xmax;
  if(yN < B.shoe)  return 'shoe';
  if(yN < B.jeans) return 'jeans';
  if(yN < B.torso) return ax > B.sleeve ? 'skin' : 'jersey';   // past the cuff
  if(yN < B.neck)  return 'skin';
  if(yN < B.hair)  return (z > B.faceZ && ax < B.faceX) ? 'skin' : 'hair';
  return 'hair';
}

const key=new Map(), OP=[], ON=[], OC=[], OI=[], tally={};
for(let f=0;f<I.length;f+=3){
  const a=I[f], b=I[f+1], c=I[f+2];
  const cx=(P[a*3]+P[b*3]+P[c*3])/3;
  const cy=(P[a*3+1]+P[b*3+1]+P[c*3+1])/3;
  const cz=(P[a*3+2]+P[b*3+2]+P[c*3+2])/3;
  const part=classify(cx,cy,cz);
  tally[part]=(tally[part]||0)+1;
  const col=rgb(C[part]);
  for(const v of [a,b,c]){
    const k=v+'|'+part;
    let at=key.get(k);
    if(at===undefined){
      at=OP.length/3; key.set(k,at);
      OP.push(P[v*3],P[v*3+1],P[v*3+2]);
      ON.push(N[v*3],N[v*3+1],N[v*3+2]);
      OC.push(col[0],col[1],col[2]);
    }
    OI.push(at);
  }
}
const outV=OP.length/3;

const F=a=>{const b=Buffer.alloc(a.length*4); for(let i=0;i<a.length;i++) b.writeFloatLE(a[i],i*4); return b;};
const U=a=>{const b=Buffer.alloc(a.length*4); for(let i=0;i<a.length;i++) b.writeUInt32LE(a[i],i*4); return b;};
const parts=[F(OP),F(ON),F(OC),U(OI)];
const pad=n=>(4-(n%4))%4; const offs=[]; let cur=0;
for(const b of parts){ offs.push(cur); cur+=b.length+pad(b.length); }
const BIN=Buffer.alloc(cur); parts.forEach((b,i)=>b.copy(BIN,offs[i]));
const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<outV;i++) for(let k=0;k<3;k++){const v=OP[i*3+k]; if(v<min[k])min[k]=v; if(v>max[k])max[k]=v;}

const json={ asset:{version:'2.0',generator:'vertex-paint'},
  scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0,name:'holder'}],
  /* baseColorFactor stays white: glTF MULTIPLIES it by COLOR_0, so a tint
     here would darken every vertex colour underneath it. */
  materials:[{name:'holder', pbrMetallicRoughness:{
    baseColorFactor:[1,1,1,1], metallicFactor:0, roughnessFactor:0.9 }}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},indices:3,material:0,mode:4}]}],
  accessors:[
    {bufferView:0,componentType:5126,count:outV,type:'VEC3',min,max},
    {bufferView:1,componentType:5126,count:outV,type:'VEC3'},
    {bufferView:2,componentType:5126,count:outV,type:'VEC3'},
    {bufferView:3,componentType:5125,count:OI.length,type:'SCALAR'}],
  bufferViews:[
    {buffer:0,byteOffset:offs[0],byteLength:parts[0].length,target:34962},
    {buffer:0,byteOffset:offs[1],byteLength:parts[1].length,target:34962},
    {buffer:0,byteOffset:offs[2],byteLength:parts[2].length,target:34962},
    {buffer:0,byteOffset:offs[3],byteLength:parts[3].length,target:34963}],
  buffers:[{byteLength:BIN.length}] };
let js=Buffer.from(JSON.stringify(json),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT,Buffer.concat([head,jh,js,bh,BIN]));
console.log(OUT.split('/').pop(), (fs.statSync(OUT).size/1024).toFixed(0)+' KB',
  ' verts '+nv+'->'+outV, ' faces:', Object.entries(tally).map(([k,v])=>k+':'+v).join(' '));
