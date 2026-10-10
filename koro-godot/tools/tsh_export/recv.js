/* The other half of the TSH export: takes what the browser game sends and writes it into koro-godot/assets/tsh,
   and hands the page the two scripts it needs (the glTF exporter, built against the game's own three.js, and the
   export itself).   node koro-godot/tools/tsh_export/recv.js   — then see README.md */
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '../../assets/tsh');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if(req.method === 'OPTIONS'){ res.end(); return; }
  const u = new URL(req.url, 'http://x');
  if(req.method === 'GET'){ const f = path.join(__dirname, path.basename(u.pathname)); if(!fs.existsSync(f)){ res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(f)); return; }
  const name = path.basename(u.searchParams.get('name') || 'out.bin');
  const chunks = []; req.on('data', c=>chunks.push(c)); req.on('end', ()=>{ const b = Buffer.concat(chunks); fs.writeFileSync(path.join(OUT, name), b); console.log('saved', name, b.length); res.end('ok ' + b.length); });
}).listen(8899, ()=>console.log('TSH export: listening on 8899, writing to ' + OUT));
