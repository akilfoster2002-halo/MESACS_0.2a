/* A reader for binary FBX 7500+ — enough of it to get a rigged character
   out and nothing more.

   The format is a tree of records: an end offset, a property count, a
   property-block length, a short name, the properties, then children
   until a null record. Everything is little-endian, and from version
   7500 the three leading numbers are 64-bit rather than 32-bit — which
   is the only thing that makes this different from every FBX parser
   written before 2016.

   Array properties may be raw or zlib-deflated, and which one is a flag
   per property rather than per file, so both have to work. */
const fs=require('fs'), zlib=require('zlib');

function parse(path){
  const b=fs.readFileSync(path);
  if(b.slice(0,20).toString('binary')!=='Kaydara FBX Binary  ')
    throw new Error('not a binary FBX');
  const version=b.readUInt32LE(23);
  const wide=version>=7500;
  const num=(o)=>wide ? Number(b.readBigUInt64LE(o)) : b.readUInt32LE(o);
  const step=wide?8:4, nullLen=wide?25:13;

  function record(off){
    const end=num(off), nProps=num(off+step), propLen=num(off+step*2);
    if(end===0) return null;
    let p=off+step*3;
    const nameLen=b.readUInt8(p); p++;
    const name=b.slice(p,p+nameLen).toString('utf8'); p+=nameLen;
    const props=[];
    const propsEnd=p+propLen;
    while(p<propsEnd){
      const t=String.fromCharCode(b.readUInt8(p)); p++;
      if(t==='Y'){ props.push(b.readInt16LE(p)); p+=2; }
      else if(t==='C'){ props.push(!!b.readUInt8(p)); p+=1; }
      else if(t==='I'){ props.push(b.readInt32LE(p)); p+=4; }
      else if(t==='F'){ props.push(b.readFloatLE(p)); p+=4; }
      else if(t==='D'){ props.push(b.readDoubleLE(p)); p+=8; }
      else if(t==='L'){ props.push(Number(b.readBigInt64LE(p))); p+=8; }
      else if(t==='S'||t==='R'){ const n=b.readUInt32LE(p); p+=4;
        props.push(t==='S' ? b.slice(p,p+n).toString('utf8') : b.slice(p,p+n)); p+=n; }
      else if('fdlib'.includes(t)){
        const len=b.readUInt32LE(p), enc=b.readUInt32LE(p+4), cl=b.readUInt32LE(p+8); p+=12;
        let raw=b.slice(p,p+cl); p+=cl;
        if(enc===1) raw=zlib.inflateSync(raw);
        const T={f:Float32Array,d:Float64Array,l:BigInt64Array,i:Int32Array,b:Uint8Array}[t];
        const per={f:4,d:8,l:8,i:4,b:1}[t];
        const a=new T(len);
        for(let k=0;k<len;k++){
          const at=k*per;
          a[k]= t==='f'?raw.readFloatLE(at) : t==='d'?raw.readDoubleLE(at)
              : t==='l'?raw.readBigInt64LE(at) : t==='i'?raw.readInt32LE(at) : raw.readUInt8(at);
        }
        props.push(a);
      }
      else throw new Error('unknown property type '+t+' at '+(p-1));
    }
    const children=[];
    while(p < end-nullLen+1 && p<end){
      const c=record(p);
      if(!c) break;
      children.push(c); p=c.end;
    }
    return { name, props, children, end };
  }

  const root={ name:'', props:[], children:[] };
  let off=27;
  while(off<b.length){
    const r=record(off);
    if(!r) break;
    root.children.push(r); off=r.end;
  }
  return { version, root };
}

const kids=(n,name)=>n.children.filter(c=>c.name===name);
const kid =(n,name)=>n.children.find(c=>c.name===name);
module.exports={parse,kid,kids};
