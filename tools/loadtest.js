#!/usr/bin/env node
/* =====================================================================
   A CLASSROOM, SIMULATED.

   "Will 28 machines run off one server without lag" is not a question
   anybody should answer from the shape of the code. This opens 28 real
   websockets against a real server, signs them in, puts them in one
   room, and drives them at exactly the rate the game drives them —
   NET.pos every 90ms, which is what planet.js sends while somebody is
   walking — then measures what a classmate's screen would actually see.

   THE NUMBER THAT MATTERS IS THE TICK GAP. The server tells every room
   where everybody is twelve and a half times a second, and that
   broadcast is the only thing making other people move on your screen.
   If it arrives every 80ms, nobody lags. If it stretches to 300, every
   classmate stutters — and no amount of frame rate on the client will
   hide it. So that gap, at the 50th, 95th and 99th percentile, is the
   headline.

   A chat message is timed as well, because it is the one thing in this
   protocol that does a true round trip: out to the server and back to
   the sender, so the clock at both ends is the same clock and the
   number needs no correction.

     node tools/dev-server.js                  # in one terminal
     node tools/loadtest.js --clients 28       # in another
   ===================================================================== */
const WebSocket = require('ws');

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 && process.argv[i+1] !== undefined ? process.argv[i+1] : d;
};
const CLIENTS = +arg('clients', 28);
const SECS    = +arg('secs', 30);
const HOST    = arg('host', '127.0.0.1:8799');
const ROOM    = arg('room', 'meadow');
const PID     = arg('pid', null);
/* 90ms is planet.js's own figure — it is in the `if(now-sent>90)` that
   guards NET.pos. Do not "round it to 100" here: the point is to be wrong
   in the same direction the game is. */
const POS_MS  = +arg('posms', 90);

const http = require('http');
function api(path, body){
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const [h, p] = HOST.split(':');
    const req = http.request({ host:h, port:+p||80, path:'/api'+path, method:'POST',
      headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(data) } },
      r => {
        const chunks=[]; r.on('data',c=>chunks.push(c));
        r.on('end', ()=>{
          const cookie = (r.headers['set-cookie']||[]).map(c=>c.split(';')[0]).join('; ');
          try{ res({ body:JSON.parse(Buffer.concat(chunks)), cookie }); }
          catch(e){ rej(new Error('bad reply from '+path)); }
        });
      });
    req.on('error', rej); req.write(data); req.end();
  });
}

const pct = (a, p) => a.length ? a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,
              Math.floor(a.length*p/100))] : 0;
const ms = n => n.toFixed(0).padStart(4) + 'ms';

async function main(){
  console.log(`opening ${CLIENTS} clients on ${HOST}, room "${ROOM}", for ${SECS}s\n`);

  const peers = [];
  for(let i=0;i<CLIENTS;i++){
    const username = 'load'+i, password = 'loadtest123';
    let r = await api('/register', { username, password, display:'Load'+i })
              .catch(()=>null);
    if(!r || !r.body.ok) r = await api('/login', { username, password });
    if(!r.body.ok) throw new Error('cannot sign in: '+(r.body.error||'?'));
    peers.push({ i, cookie:r.cookie });
  }

  const gaps=[], round=[];
  let bytes=0, msgs=0, rosters=0, opened=0, closed=0;

  await Promise.all(peers.map(peer => new Promise(done => {
    const ws = new WebSocket('ws://'+HOST+'/ws', { headers:{ Cookie:peer.cookie } });
    peer.ws = ws;
    ws.on('open', ()=>{ opened++; ws.send(JSON.stringify({ t:'join', server:ROOM })); done(); });
    ws.on('close', ()=>closed++);
    ws.on('error', e=>{ console.error('socket', peer.i, e.message); done(); });
    ws.on('message', raw => {
      msgs++; bytes += raw.length;
      let m; try{ m = JSON.parse(raw); }catch(e){ return; }
      if(m.t === 'players'){
        rosters++;
        const now = Date.now();
        /* Only the first client times the gap. Twenty-eight sets of the
           same number is twenty-eight copies of one measurement, and the
           spread would look like jitter that is not there. */
        if(peer.i === 0){
          if(peer.last) gaps.push(now - peer.last);
          peer.last = now;
        }
      }
      if(m.t === 'chat' && m.text && m.text.startsWith('ping:') && peer.i === 0)
        round.push(Date.now() - +m.text.slice(5));
    });
  })));
  console.log(`${opened}/${CLIENTS} connected`);

  // everybody walks, at the rate the game walks them
  let step = 0;
  const walk = setInterval(()=>{
    step++;
    for(const p of peers){
      if(p.ws.readyState !== 1) continue;
      const a = step*0.05 + p.i;
      p.ws.send(JSON.stringify({ t:'pos',
        x:+(Math.cos(a)*30).toFixed(2), z:+(Math.sin(a)*20).toFixed(2),
        yaw:+(a%6.28).toFixed(3), char:'s', act:'walk', ride:null, at:'hub' }));
    }
  }, POS_MS);
  // and one of them says something every two seconds, to time a round trip
  const talk = setInterval(()=>{
    if(peers[0].ws.readyState===1)
      peers[0].ws.send(JSON.stringify({ t:'chat', text:'ping:'+Date.now() }));
  }, 2000);

  const cpu = [];
  const watch = PID ? setInterval(()=>{
    require('child_process').execFile('ps', ['-o','%cpu=,rss=','-p',PID], (e,out)=>{
      if(e || !out) return;
      const [c, r] = out.trim().split(/\s+/).map(Number);
      cpu.push({ c, r });
    });
  }, 1000) : null;

  await new Promise(r => setTimeout(r, SECS*1000));
  clearInterval(walk); clearInterval(talk); if(watch) clearInterval(watch);
  peers.forEach(p => { try{ p.ws.close(); }catch(e){} });
  await new Promise(r => setTimeout(r, 400));

  const sent = step * CLIENTS;
  console.log('\n--- what the server was asked to do ---');
  console.log(`  position updates in   ${sent} (${(sent/SECS).toFixed(0)}/s)`);
  console.log(`  messages out          ${msgs} (${(msgs/SECS).toFixed(0)}/s)`);
  console.log(`  bandwidth out         ${(bytes/SECS/1048576).toFixed(2)} MB/s`
            + `  (${(bytes/SECS/CLIENTS/1024).toFixed(1)} KB/s each)`);

  console.log('\n--- the gap between roster ticks (80ms is the target) ---');
  console.log(`  median  ${ms(pct(gaps,50))}      95th ${ms(pct(gaps,95))}`
            + `      99th ${ms(pct(gaps,99))}      worst ${ms(Math.max(...gaps,0))}`);
  console.log('\n--- chat round trip, out and back ---');
  console.log(`  median  ${ms(pct(round,50))}      95th ${ms(pct(round,95))}`
            + `      worst ${ms(Math.max(...round,0))}`);
  if(cpu.length){
    const c = cpu.map(x=>x.c);
    console.log('\n--- the server process ---');
    console.log(`  cpu     median ${pct(c,50).toFixed(1)}%   peak ${Math.max(...c).toFixed(1)}%`
              + `   memory ${(Math.max(...cpu.map(x=>x.r))/1024).toFixed(0)} MB`);
  }

  /* A verdict, in the terms the question was asked in. */
  const p95 = pct(gaps,95);
  console.log('\n--- verdict ---');
  console.log(p95 < 130
    ? `  ${CLIENTS} clients: no lag from the server. The roster keeps its 80ms beat.`
    : p95 < 250
    ? `  ${CLIENTS} clients: the beat is slipping (95th ${ms(p95)}). Watchable, not smooth.`
    : `  ${CLIENTS} clients: the server is behind (95th ${ms(p95)}). This would read as lag.`);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
