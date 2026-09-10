#!/usr/bin/env node
/* =====================================================================
   The rig that gets a video out of the game.

   The trailer is recorded INSIDE the page — MediaRecorder on a canvas the
   director composites, which is the only way to get thirty real frames a
   second out of a running game rather than a slideshow of screenshots.
   That leaves one problem: the page cannot write a file. A sandboxed
   preview refuses downloads, and passing eleven megabytes of base64 back
   up through a tool call is not a thing anybody should do.

   So this is the other end of the wire. It serves the director to the
   page (same-origin rules do not apply to a script the page fetches and
   evals, but CORS does, hence the headers) and takes the finished video
   back as a POST.

   It is a LOCAL, TEMPORARY tool. It binds to 127.0.0.1, it writes only
   inside the repository, and nothing in the game knows it exists.
   ===================================================================== */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PORT = +(process.env.PROMO_PORT || 9099);

const cors = res => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
};

http.createServer((req, res)=>{
  cors(res);
  const url = new URL(req.url, 'http://x');

  if(req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }

  if(req.method === 'GET' && /^\/(director|cut)\.js$/.test(url.pathname)){
    res.writeHead(200, {'Content-Type':'application/javascript; charset=utf-8'});
    return res.end(fs.readFileSync(path.join(__dirname, url.pathname.slice(1))));
  }

  /* Read one back, so the video can be checked by looking at it: the page
     loads it into a <video>, seeks, and tiles the frames into a contact
     sheet. Otherwise the only way to know what was recorded is to record
     it and hope. */
  if(req.method === 'GET' && url.pathname === '/file'){
    const name = path.basename(url.searchParams.get('name') || '');
    const from = [path.join(ROOT,name), path.join(require('os').tmpdir(),name)]
      .find(f=>fs.existsSync(f)) || path.join(ROOT,name);
    if(!name || !fs.existsSync(from)){ res.writeHead(404); return res.end('no'); }
    res.writeHead(200, {'Content-Type': name.endsWith('.mp4') ? 'video/mp4'
      : name.endsWith('.png') ? 'image/png' : 'video/webm'});
    return fs.createReadStream(from).pipe(res);
  }

  if(req.method === 'POST' && url.pathname === '/save'){
    /* The name is ours, not the page's: basename only, and only into the
       repository root. A local tool is still a tool that writes files. */
    const name = path.basename(url.searchParams.get('name') || 'koro.mp4');
    const dir  = url.searchParams.get('dir') === 'tmp'
      ? require('os').tmpdir() : ROOT;
    const to = path.join(dir, name);
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', ()=>{
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(to, buf);
      console.log(`saved ${name} — ${(buf.length/1048576).toFixed(2)} MB`);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok:true, name, bytes:buf.length }));
    });
    return;
  }

  res.writeHead(404); res.end('no');
}).listen(PORT, '127.0.0.1', ()=>
  console.log('promo rig on http://127.0.0.1:'+PORT));
