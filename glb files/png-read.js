/* Enough of PNG to read a reference sheet: IHDR, the IDAT stream, and
   the five scanline filters. No interlacing, no palettes, no 16-bit —
   which covers every file an artist exports from anything.

   It is here so the colours a character is painted in can be MEASURED
   off the drawing rather than typed in by eye. Picking a red out of the
   air and picking the red that is actually in the picture are different
   jobs, and only one of them can be checked. */
const fs=require('fs'), zlib=require('zlib');

function decode(path){
  const b=fs.readFileSync(path);
  if(b.readUInt32BE(0)!==0x89504E47) throw new Error('not a PNG');
  let off=8, ihdr=null; const idat=[];
  while(off<b.length){
    const len=b.readUInt32BE(off), type=b.slice(off+4,off+8).toString('ascii');
    const data=b.slice(off+8, off+8+len);
    if(type==='IHDR') ihdr={ w:data.readUInt32BE(0), h:data.readUInt32BE(4),
                             depth:data.readUInt8(8), color:data.readUInt8(9),
                             interlace:data.readUInt8(12) };
    else if(type==='IDAT') idat.push(data);
    else if(type==='IEND') break;
    off+=12+len;
  }
  if(ihdr.depth!==8) throw new Error('only 8-bit PNGs');
  if(ihdr.interlace) throw new Error('interlaced PNGs not handled');
  const ch={0:1,2:3,4:2,6:4}[ihdr.color];
  if(!ch) throw new Error('colour type '+ihdr.color+' not handled');
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const {w,h}=ihdr, stride=w*ch;
  const out=Buffer.alloc(stride*h);
  let prev=Buffer.alloc(stride);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)];
    const line=raw.slice(y*(stride+1)+1, y*(stride+1)+1+stride);
    const cur=Buffer.alloc(stride);
    for(let i=0;i<stride;i++){
      const a=i>=ch?cur[i-ch]:0, bU=prev[i], c=i>=ch?prev[i-ch]:0;
      let v=line[i];
      if(f===1) v+=a;
      else if(f===2) v+=bU;
      else if(f===3) v+=(a+bU)>>1;
      else if(f===4){ const p=a+bU-c, pa=Math.abs(p-a), pb=Math.abs(p-bU), pc=Math.abs(p-c);
                      v+= (pa<=pb&&pa<=pc)?a : (pb<=pc)?bU : c; }
      cur[i]=v&255;
    }
    cur.copy(out, y*stride); prev=cur;
  }
  /* always handed back as RGBA, so nothing downstream has to care which
     of the four colour types it came from */
  const rgba=Buffer.alloc(w*h*4);
  for(let i=0;i<w*h;i++){
    const s=i*ch;
    if(ch===1){ rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=out[s]; rgba[i*4+3]=255; }
    else if(ch===2){ rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=out[s]; rgba[i*4+3]=out[s+1]; }
    else if(ch===3){ rgba[i*4]=out[s]; rgba[i*4+1]=out[s+1]; rgba[i*4+2]=out[s+2]; rgba[i*4+3]=255; }
    else { out.copy(rgba, i*4, s, s+4); }
  }
  return { w, h, data:rgba };
}
module.exports={decode};
