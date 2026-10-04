/* LOWER MANHATTAN round the district (public/tshnyc.js, tools/pack-nyc.py).

   What has to stay true: the packed model is whole and readable, nothing
   of it stands inside the district Robin plays in, the land it lays road on
   reaches the district's edge, and the quest still hangs it on the city
   and lets it go again. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function unpack(){
  const buf = fs.readFileSync(path.join(__dirname, '..', 'public/tsh/nyc/nyc.bin'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const dv = new DataView(ab);
  assert.strictEqual(buf.toString('latin1', 0, 4), 'NYC1', 'not a packed city');
  const nv = dv.getUint32(4, true), ni = dv.getUint32(8, true), nr = dv.getUint32(12, true), q = dv.getFloat32(16, true);
  let o = 20;
  const qp = new Int16Array(ab, o, nv*3); o += nv*6;
  o += nv*4; o += (4 - o%4) % 4;
  const idx = new Uint32Array(ab, o, ni); o += ni*4;
  const rects = new Float32Array(ab, o, nr*4); o += nr*16;
  return { nv, ni, nr, q, qp, idx, rects, end:o, size:ab.byteLength };
}

test('the packed city is whole', ()=>{
  const d = unpack();
  assert.strictEqual(d.end, d.size, 'the file is not exactly what its header says');
  assert.ok(d.ni % 3 === 0 && d.ni/3 > 100000, 'too few triangles to be the city');
  let max = 0; for(let i=0;i<d.ni;i++) if(d.idx[i] > max) max = d.idx[i];
  assert.ok(max < d.nv, 'an index points past the vertices');
});

test('nothing of Manhattan stands in the district', ()=>{
  const d = unpack();
  let inside = 0;
  for(let t=0;t<d.ni;t+=3){
    let x = 0, z = 0;
    for(let k=0;k<3;k++){ const v = d.idx[t+k]*3; x += d.qp[v]*d.q; z += d.qp[v+2]*d.q; }
    x /= 3; z /= 3;
    if(Math.abs(x) < 120 && Math.abs(z) < 95) inside++;
  }
  assert.strictEqual(inside, 0, `${inside} triangles of the model stand inside the district`);
});

test('the road reaches the district on every side', ()=>{
  const d = unpack();
  // a point just past each hoarding should be on land, or the district stands in the harbour
  for(const [x, z] of [[140, 0], [-140, 0], [0, 115], [0, -115]]){
    let on = false;
    for(let i=0;i<d.rects.length;i+=4) if(x >= d.rects[i] && x <= d.rects[i+1] && z >= d.rects[i+2] && z <= d.rects[i+3]) on = true;
    assert.ok(on, `no land at ${x}, ${z}`);
  }
});

test('the quest hangs Manhattan on the city, tells it the air, and lets it go', ()=>{
  const tsh = read('public/tsh.js');
  assert.match(tsh, /W = CITY\.build\(root\);\s*if\(window\.TSHNYC\) TSHNYC\.attach\(W\.cityGroup, W\);/);
  assert.match(tsh, /G\.scene\.fog = new THREE\.FogExp2\(fogCol, fogD\);\s*if\(window\.TSHNYC\) TSHNYC\.look\(day\(\), fogCol, fogD\);/);
  assert.match(tsh, /LOOK\.dispose\(\);\s*if\(window\.TSHNYC\) TSHNYC\.detach\(\);/);
  const html = read('public/index.html');
  assert.ok(html.indexOf('tshnyc.js') > html.indexOf('tshcity.js'), 'tshnyc.js must load after tshcity.js');
  // the box skyline is gone, and the seed it drew from is still drawn so the district does not move
  const city = read('public/tshcity.js');
  assert.ok(!/const far = new THREE\.Group\(\)/.test(city), 'the box skyline is still built');
  assert.match(city, /draw the same numbers, so everything after them is where it was/);
});
