/* A GLB reader that respects byteStride. gltf-transform writes interleaved
   vertex buffers by default, so a tightly-packed read walks straight into
   the normals and reports a sphere where a person is standing. */
const fs=require('fs');
function readGLB(path){
  const b=fs.readFileSync(path);
  let off=12,json=null,bin=null;
  while(off<b.length){const len=b.readUInt32LE(off),t=b.readUInt32LE(off+4);
    if(t===0x4E4F534A) json=JSON.parse(b.slice(off+8,off+8+len).toString('utf8'));
    else if(t===0x004E4942) bin=b.slice(off+8,off+8+len);
    off+=8+len; if(!len)break;}
  return {json,bin,buf:b};
}
const NCOMP={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function readAccessor(g,bin,i){
  const a=g.accessors[i], bv=g.bufferViews[a.bufferView];
  const n=NCOMP[a.type];
  const base=(bv.byteOffset||0)+(a.byteOffset||0);
  const stride=bv.byteStride || 0;
  const CT={5126:[Float32Array,4],5125:[Uint32Array,4],5123:[Uint16Array,2],5121:[Uint8Array,1]};
  const [Arr,sz]=CT[a.componentType];
  const out=new (a.componentType===5126?Float32Array:Float64Array)(a.count*n);
  const step = stride || n*sz;
  for(let v=0;v<a.count;v++){
    for(let c=0;c<n;c++){
      const at=bin.byteOffset+base+v*step+c*sz;
      out[v*n+c] = a.componentType===5126 ? bin.buffer instanceof ArrayBuffer
        ? new DataView(bin.buffer).getFloat32(at,true) : 0
        : a.componentType===5125 ? new DataView(bin.buffer).getUint32(at,true)
        : a.componentType===5123 ? new DataView(bin.buffer).getUint16(at,true)
        : new DataView(bin.buffer).getUint8(at);
    }
  }
  return out;
}
module.exports={readGLB,readAccessor};
