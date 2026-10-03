/* =====================================================================
   LANDMARKS WITHOUT A PERSON PICKING THEM: the 21 points morphs.js bends
   the facial rig's face onto (eyes, brows, nose, mouth, chin, cheeks,
   jaw), found on a new body from one that was picked by eye.

   1. HIS NOSE. The front-most point of his head near the middle line,
      between the chin and the eyes (a cap's brim is above that band, a
      chin is behind the nose).
   2. ROBIN'S FACE, MOVED AND SIZED. Every one of her landmarks, as an
      offset from her nose tip, scaled by his height over hers, from his.
   3. ONTO HIS SKIN. Each point keeps its x and y and takes the front-most
      point of his face within a few millimetres of them — the surface, not
      somewhere inside his head.

     node face/autolandmarks.js <body.glb> <out.json> [ref.glb ref.landmarks.json]
   ===================================================================== */
const io = require('./glbio'), fs = require('fs');
const [,, bodyPath, outPath, refBody, refMarks] = process.argv;
const REF = require(refMarks ? require('path').resolve(refMarks) : './robin.landmarks.json');
function points(path){ const g = io.read(path), prim = g.json.meshes[0].primitives[0]; return io.acc(g, prim.attributes.POSITION); }
function height(P){ let lo = 1e9, hi = -1e9; P.forEach(p=>{ lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }); return [lo, hi]; }
function noseOf(P, H){
  // the band of the head the nose is in: about 6–10 % of the height down from the top
  const [lo, hi] = H, h = hi - lo, y0 = hi - h*0.115, y1 = hi - h*0.06;
  let best = null;
  P.forEach(p=>{ if(p[1] < y0 || p[1] > y1 || Math.abs(p[0]) > 0.02) return; if(!best || p[2] > best[2]) best = p; });
  return best;
}
const P = points(bodyPath), H = height(P);
const refP = refBody ? points(refBody) : null, refH = refP ? height(refP) : null;
const nose = noseOf(P, H);
const k = refH ? (H[1] - H[0])/(refH[1] - refH[0]) : 1;
const out = {};
for(const name in REF){
  const r = REF[name], x = nose[0] + (r[0] - REF.noseTip[0])*k, y = nose[1] + (r[1] - REF.noseTip[1])*k;
  // the front-most skin within 4 mm of (x, y), in front of the middle of his head
  let z = null, rad = 0.004;
  while(z === null && rad < 0.03){ P.forEach(p=>{ if(Math.hypot(p[0] - x, p[1] - y) < rad && p[2] > nose[2] - 0.06 && (z === null || p[2] > z)) z = p[2]; }); rad *= 1.6; }
  out[name] = [+x.toFixed(4), +y.toFixed(4), +(z === null ? nose[2] + (r[2] - REF.noseTip[2])*k : z).toFixed(4)];
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('nose', nose.map(v=>+v.toFixed(4)), 'height', (H[1] - H[0]).toFixed(3), 'scale', k.toFixed(3), '→', outPath);
