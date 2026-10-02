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
  const br = await puppeteer.launch({ headless:'new', args:['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const pg = await br.newPage(); await pg.setViewport({ width:1024, height:1024 });
  pg.on('pageerror', e=>console.error('page:', e.message)); pg.on('console', m=>{ if(m.type() === 'error' || m.type() === 'warn') console.error('page:', m.text()); else console.log('page:', m.text()); });
  const page = process.argv[2] === 'try' ? 'try.html' : 'lab.html';
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
      const r = await L.pg.evaluate((b, f, c, t, hd, ch)=>{ TRY.head = hd; TRY.chest = ch; return TRY(b, f, c, t); }, b, fit || '', clip || 'idle', +(at || 0), !!process.env.HEAD, !!process.env.CHEST);
      await L.pg.screenshot({ path:out, type:'jpeg', quality:80 }); console.log('wrote', out, JSON.stringify(r));
    }
    if(cmd === 'transfer'){                                        // transfer <garment.glb> <from-body.glb> <to-body.glb> <out.glb>
      const [g, r, b, out] = args;
      const res = await L.pg.evaluate((a, b, c, d)=>LAB.transfer(a, b, c, d), L.url(g), L.url(r), L.url(b), L.url(out));
      console.log('wrote', out, JSON.stringify(res));
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
