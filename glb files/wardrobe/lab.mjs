#!/usr/bin/env node
/* =====================================================================
   THE WARDROBE LAB — node glb\ files/wardrobe/lab.mjs <command> ...

   The Node half: a little static server over the repository (so the lab
   page can import three from node_modules and read public/), headless
   Chrome running lab.html, and the files. Each command is one call into
   window.LAB (lab.js) and its result written to disk.

     render <character.glb> <out.png> [front|side]
     base    <sam.glb> <character.glb> <out.glb>   SAM's base-outfit body, rigged as the character
     garment <sam.glb> <body.glb> <ref.png> <garment.png> <out.glb>
                                         a garment drawn on the body's reference picture, put on the body
     extract <dressed.glb> <body.glb> <out.glb> [options json]
                                         THE CLEAN WAY: the garment cut out of the same person lifted
                                         again wearing it; options: on (regions), colour, gap, over, reach
     transfer <garment.glb> <from.glb> <to.glb> <out.glb>
                                         a garment made for one body, fitted to another
     card    <character.glb> <out.png>  the 256x328 roster card
   ===================================================================== */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const { default:puppeteer } = await import(path.join(ROOT, 'tools/tiktok/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js'));
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary', '.webp':'image/webp' };

export async function lab(){
  const srv = http.createServer((q, r)=>{
    const u = decodeURIComponent(q.url.split('?')[0]), f = path.join(ROOT, u);
    if(!f.startsWith(ROOT)){ r.writeHead(403); return r.end(); }
    if(q.method === 'POST'){                                      // the page hands files back this way
      const parts = []; q.on('data', d=>parts.push(d)); q.on('end', ()=>{ fs.mkdirSync(path.dirname(f), { recursive:true }); fs.writeFileSync(f, Buffer.concat(parts)); r.writeHead(200); r.end('ok'); });
      return;
    }
    fs.readFile(f, (e, b)=>{ if(e){ r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type':TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
  });
  await new Promise(ok=>srv.listen(0, ok));
  const port = srv.address().port;
  const br = await puppeteer.launch({ headless:'new', protocolTimeout:0, args:['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage(); await pg.setViewport({ width:1024, height:1024 });
  pg.on('pageerror', e=>console.error('page:', e.message)); pg.on('console', m=>{ if(m.type() === 'error' || m.type() === 'warn') console.error('page:', m.text()); else console.log('page:', m.text()); });
  const page = (['try', 'check', 'moves'].includes(process.argv[2]) || process.env.PAGE === 'try') ? 'try.html' : 'lab.html';
  await pg.goto(`http://localhost:${port}/glb files/wardrobe/${page}`);
  await pg.waitForFunction(page === 'try.html' ? 'window.TRY && window.TRY.ready' : 'window.LAB && window.LAB.ready', { timeout:60000 });
  const url = p => '/' + path.relative(ROOT, path.resolve(p)).split(path.sep).join('/');
  return { pg, url, root:ROOT, close:async()=>{ await br.close(); srv.close(); } };
}

const [cmd, ...args] = process.argv.slice(2);
if(cmd){
  const L = await lab();
  try{
    if(cmd === 'render'){
      const [inp, out, view, clip, at] = args;
      const r = await L.pg.evaluate((u, v, c, t)=>LAB.render(u, v, c, t), L.url(inp), view || 'front', clip || null, +(at || 0));
      fs.writeFileSync(out, Buffer.from(r.png.split(',')[1], 'base64'));
      fs.writeFileSync(out.replace(/\.png$/, '.frame.json'), JSON.stringify(r.frame, null, 1));
      console.log('wrote', out, JSON.stringify(r.frame));
    }
    if(cmd === 'garment'){                                         // garment <sam.glb> <body.glb> <ref.png> <garment.png> <out.glb>
      const [sam, b, ref, gar, out] = args;
      const r = await L.pg.evaluate((a, b, c, d, e)=>LAB.garment(a, b, c, d, e), L.url(sam), L.url(b), L.url(ref), L.url(gar), L.url(out));
      console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'try'){                                             // try <body> <slot:item,...> <out.jpg> [clip] [time]
      const [b, fit, out, clip, at] = args;
      const r = await L.pg.evaluate((b, f, c, t, hd, ch, hn, bg, ft)=>{ TRY.head = hd; TRY.chest = ch; TRY.hand = hn; TRY.bg = bg; TRY.feet = ft; return TRY(b, f, c, t); }, b, fit || '', clip || 'idle', +(at || 0), !!process.env.HEAD, !!process.env.CHEST, (process.env.HAND || null), process.env.BG || null, !!process.env.FEET);
      fs.writeFileSync(out, Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot; console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'moves'){                                           // moves <body> <moves.glb|-> <a,b,c> <out.jpg> [frac] [slots]
      const [b, f, list, out, frac, slots] = args;
      const r = await L.pg.evaluate((b, u, l, fr, sl)=>TRY.moves(b, u, l, fr, sl), b, f === '-' ? null : L.url(f), list.split(','), frac ? (frac.includes(',') ? frac.split(',').map(Number) : +frac) : 0.45, slots || null);
      fs.writeFileSync(out, Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot; console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'check'){                                           // check <body> <slot:item,...> <out.jpg>  — every clip, measured; recorded in qa.json
      const [b, fit, out] = args;
      const r = await L.pg.evaluate((b, f)=>TRY.check(b, f), b, fit || '');
      fs.writeFileSync(out, Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot;
      const crypto = await import('node:crypto'), sha = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
      const W = await L.pg.evaluate(()=>({ ITEMS:Object.fromEntries(Object.entries(WARDROBE.ITEMS).map(([k, v])=>[k, { kind:v.kind, model:v.model }])) }));
      const files = { body:sha(path.join(ROOT, 'public/characters/models/character-' + b + '.glb')) };
      String(fit || '').split(',').filter(Boolean).forEach(p=>{ const id = p.split(':')[1], it = W.ITEMS[id]; if(!it) return;
        const f = it.kind === 'garment' ? 'public/characters/wardrobe/' + id + '/' + b + '.glb' : it.kind === 'accessory' ? 'public/characters/wardrobe/' + it.model + '.glb' : null;
        if(f) files[id] = sha(path.join(ROOT, f)); });
      const LIMIT = { holes:5, poke:25, doubled:2, skin:15, buried:20 };   // thousandths (of the skin each could happen to; of the garment, for skin and buried), worst frame
      const pass = r.holes.worst <= LIMIT.holes && r.poke.worst <= LIMIT.poke && r.doubled.worst <= LIMIT.doubled && r.skin <= LIMIT.skin && r.buried <= LIMIT.buried;
      const qaPath = path.join(HERE, 'qa.json'), qa = fs.existsSync(qaPath) ? JSON.parse(fs.readFileSync(qaPath, 'utf8')) : {};
      const key = b + ' ' + String(fit || '').split(',').filter(Boolean).sort().join(',');
      qa[key] = { pass, files, holes:r.holes, poke:r.poke, doubled:r.doubled, skin:r.skin, buried:r.buried, mean:r.mean, frames:r.frames, limit:LIMIT };
      fs.writeFileSync(qaPath, JSON.stringify(Object.fromEntries(Object.entries(qa).sort()), null, 1) + '\n');
      console.log((pass ? 'PASS ' : 'FAIL ') + key, JSON.stringify(r));
    }
    if(cmd === 'eval'){                                            // eval <js>  (debugging: an async expression in the lab page)
      const r = await L.pg.evaluate(async src=>JSON.stringify(await (0, eval)('(async()=>{' + src + '})()')), args[0]);
      console.log(r);
    }
    if(cmd === 'extract'){                                         // extract <dressed.glb> <body.glb> <out.glb> [json options]
      const [d, b, out, opt] = args; const o = opt ? JSON.parse(opt) : {};
      if(o.over) o.over = [].concat(o.over).map(L.url);
      if(o.ref) o.ref = L.url(o.ref); if(o.pic) o.pic = L.url(o.pic);
      const r = await L.pg.evaluate((a, b, c, o)=>LAB.extract(a, b, c, o), L.url(d), L.url(b), L.url(out), o);
      fs.writeFileSync(out.replace(/\.glb$/, '-cut.jpg'), Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot;
      console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'transfer'){                                        // transfer <garment.glb> <from-body.glb> <to-body.glb> <out.glb>
      const [g, r, b, out, opt] = args;
      const res = await L.pg.evaluate((a, b, c, d, o)=>LAB.transfer(a, b, c, d, o), L.url(g), L.url(r), L.url(b), L.url(out), opt ? JSON.parse(opt) : {});
      console.log('wrote', out, JSON.stringify(res));
    }
    if(cmd === 'clean'){                                           // clean <garment.glb> <body.glb> <out.glb> [json options]
      const [gar, b, out, opt] = args;
      const r = await L.pg.evaluate((a, b, c, o)=>LAB.clean(a, b, c, o), L.url(gar), L.url(b), L.url(out), opt ? JSON.parse(opt) : {});
      console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'card'){                                            // card <character.glb> <out.png>
      const [inp, out] = args;
      const png = await L.pg.evaluate(u=>LAB.card(u), L.url(inp));
      fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64')); console.log('wrote', out);
    }
    if(cmd === 'base'){                                            // base <sam.glb> <character.glb> <out.glb>
      const [sam, ch, out] = args;
      const r = await L.pg.evaluate((a, b, c)=>LAB.base(a, b, c), L.url(sam), L.url(ch), L.url(out));
      console.log('wrote', out, JSON.stringify(r));
    }
  } finally { await L.close(); }
}
