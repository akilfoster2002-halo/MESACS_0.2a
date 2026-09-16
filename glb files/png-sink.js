/* Somewhere for preview-png.html to put the picture it just made.

   A canvas can render the thumbnail but it cannot save one: toDataURL
   hands back a string inside the tab, and everything a page can do with
   that ends in a downloads folder under whatever name the browser felt
   like. This is nine lines that let the page POST the bytes to the path
   they belong at instead.

   Nothing in the game talks to it and it is not started by anything —
   it runs for as long as one thumbnail takes.

     node png-sink.js &
     open '/glb%20files/preview-png.html?m=robin.glb&save=../public/characters/previews/character-w.png'

   The path is resolved inside the repository and refused anywhere else:
   this listens on a port with no authentication in front of it, and a
   save tool that will write to any absolute path on the machine is a
   different kind of tool. */
const http=require('http'), fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname, '..');
const PORT=+process.env.PORT || 8792;

http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','content-type');
  if(req.method==='OPTIONS') return res.end();
  if(req.method!=='POST'){ res.writeHead(405); return res.end('POST only'); }

  const want=path.resolve(__dirname, decodeURIComponent(req.url.slice(1)));
  if(want!==ROOT && !want.startsWith(ROOT+path.sep)){
    res.writeHead(403); return res.end('outside the repository');
  }
  const chunks=[];
  req.on('data', c=>chunks.push(c));
  req.on('end', ()=>{
    const body=Buffer.concat(chunks);
    /* The page sends base64 rather than binary because that is what
       toDataURL produced, and re-encoding it in the tab to send fewer
       bytes over localhost is work for nothing. */
    const buf=Buffer.from(body.toString('utf8'), 'base64');
    fs.mkdirSync(path.dirname(want), {recursive:true});
    fs.writeFileSync(want, buf);
    console.log(path.relative(ROOT, want), buf.length+' bytes');
    res.end('ok');
  });
}).listen(PORT, ()=>console.log('png-sink on '+PORT+', writing under '+ROOT));
