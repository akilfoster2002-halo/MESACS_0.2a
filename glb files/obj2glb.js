/* OBJ -> GLB. Positions and normals only, which is all this one has.

   A face corner in an OBJ names its position and its normal separately, so
   a vertex that is shared between two faces with different normals is one
   `v` and two corners. glTF has no such thing: one vertex, one normal. So
   corners are keyed by the PAIR and split where they disagree — which is
   what makes a hard edge stay hard. */
const fs=require('fs');
const IN=process.argv[2], OUT=process.argv[3];
const src=fs.readFileSync(IN,'utf8');

const V=[], N=[];
const key=new Map(), P=[], NN=[], I=[];
let line='', at=0;
for(const raw of src.split('\n')){
  if(raw.charCodeAt(0)===118){                 // 'v'
    if(raw[1]===' '){ const p=raw.split(/\s+/); V.push(+p[1],+p[2],+p[3]); continue; }
    if(raw[1]==='n'){ const p=raw.split(/\s+/); N.push(+p[1],+p[2],+p[3]); continue; }
    continue;
  }
  if(raw.charCodeAt(0)!==102 || raw[1]!==' ') continue;   // 'f '
  const parts=raw.trim().split(/\s+/).slice(1);
  const idx=parts.map(c=>{
    let k=key.get(c);
    if(k===undefined){
      k=P.length/3; key.set(c,k);
      const bits=c.split('/');
      const vi=(+bits[0]-1)*3, ni=bits[2]?(+bits[2]-1)*3:-1;
      P.push(V[vi],V[vi+1],V[vi+2]);
      if(ni>=0) NN.push(N[ni],N[ni+1],N[ni+2]); else NN.push(0,1,0);
    }
    return k;
  });
  for(let i=1;i+1<idx.length;i++) I.push(idx[0], idx[i], idx[i+1]);   // fan, for quads
}
const nv=P.length/3;

/* An OBJ need not carry normals, and a decimator often drops them. Without
   any, every face gets the same up vector and the model renders as a flat
   silhouette — so they are rebuilt here, area-weighted from the faces that
   share each vertex. */
if(N.length===0){
  const AX=new Float64Array(nv), AY=new Float64Array(nv), AZ=new Float64Array(nv);
  for(let f=0;f<I.length;f+=3){
    const a=I[f],b=I[f+1],c=I[f+2];
    const ux=P[b*3]-P[a*3], uy=P[b*3+1]-P[a*3+1], uz=P[b*3+2]-P[a*3+2];
    const vx=P[c*3]-P[a*3], vy=P[c*3+1]-P[a*3+1], vz=P[c*3+2]-P[a*3+2];
    const cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx;
    for(const t of [a,b,c]){ AX[t]+=cx; AY[t]+=cy; AZ[t]+=cz; }
  }
  for(let i=0;i<nv;i++){
    const l=Math.hypot(AX[i],AY[i],AZ[i])||1;
    NN[i*3]=AX[i]/l; NN[i*3+1]=AY[i]/l; NN[i*3+2]=AZ[i]/l;
  }
  console.log('(no normals in the obj — rebuilt from the faces)');
}

const F=a=>{const b=Buffer.alloc(a.length*4); for(let i=0;i<a.length;i++) b.writeFloatLE(a[i],i*4); return b;};
const U=a=>{const b=Buffer.alloc(a.length*4); for(let i=0;i<a.length;i++) b.writeUInt32LE(a[i],i*4); return b;};
const parts=[F(P),F(NN),U(I)];
const pad=n=>(4-(n%4))%4; const offs=[]; let cur=0;
for(const b of parts){ offs.push(cur); cur+=b.length+pad(b.length); }
const BIN=Buffer.alloc(cur); parts.forEach((b,i)=>b.copy(BIN,offs[i]));
const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<nv;i++) for(let k=0;k<3;k++){const v=P[i*3+k]; if(v<mn[k])mn[k]=v; if(v>mx[k])mx[k]=v;}

const g={ asset:{version:'2.0',generator:'obj2glb'}, scene:0, scenes:[{nodes:[0]}],
  nodes:[{mesh:0,name:'ship'}],
  materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:0.85}}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material:0,mode:4}]}],
  accessors:[
    {bufferView:0,componentType:5126,count:nv,type:'VEC3',min:mn,max:mx},
    {bufferView:1,componentType:5126,count:nv,type:'VEC3'},
    {bufferView:2,componentType:5125,count:I.length,type:'SCALAR'}],
  bufferViews:[
    {buffer:0,byteOffset:offs[0],byteLength:parts[0].length,target:34962},
    {buffer:0,byteOffset:offs[1],byteLength:parts[1].length,target:34962},
    {buffer:0,byteOffset:offs[2],byteLength:parts[2].length,target:34963}],
  buffers:[{byteLength:BIN.length}] };
let js=Buffer.from(JSON.stringify(g),'utf8');
if(js.length%4) js=Buffer.concat([js,Buffer.alloc(4-(js.length%4),0x20)]);
const head=Buffer.alloc(12); head.write('glTF',0);
head.writeUInt32LE(2,4); head.writeUInt32LE(12+8+js.length+8+BIN.length,8);
const jh=Buffer.alloc(8); jh.writeUInt32LE(js.length,0); jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8); bh.writeUInt32LE(BIN.length,0); bh.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT, Buffer.concat([head,jh,js,bh,BIN]));
console.log('verts',nv.toLocaleString(),' tris',(I.length/3).toLocaleString(),
  ' ',(fs.statSync(IN).size/1048576).toFixed(1)+' MB ->',(fs.statSync(OUT).size/1048576).toFixed(1)+' MB');
