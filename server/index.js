/* =====================================================================
   Mission: Linux — server
   Serves the game, handles sign-in, saves progress, and runs the shared
   rooms: player presence plus chat that a teacher can watch, mute and
   clear in real time.

   Rooms are a fixed list of named servers a student picks from, not
   classes a teacher has to create first. Signing up needs nothing but a
   username and a password — no codes, from anybody.
   ===================================================================== */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const db = require('./db');
const auth = require('./auth');

const app = express();
app.use(express.json({ limit:'16kb' }));
app.use(express.static(path.join(__dirname,'..','public'), {
  etag:true,
  setHeaders(res,file){
    // game code must never be stale after a deploy; the vendored engine can cache
    // game code and pages: always revalidate, so a deploy is live on refresh.
    // models, previews and fonts: safe to cache hard.
    if(/\.(js|html)$/.test(file)) res.setHeader('Cache-Control','no-cache');
    else res.setHeader('Cache-Control','public, max-age=86400');
  }
}));

/* The rooms. A fixed list beats letting students name their own: nothing to
   moderate, the teacher can watch all of them, and a room always exists to
   join — no setup, by anyone, before two people can stand together. */
const SERVERS = [
  { id:'meadow',  name:'Meadow',  em:'🌾', a:'#a8e6cf' },
  { id:'canyon',  name:'Canyon',  em:'🏜️', a:'#ffb4a2' },
  { id:'harbour', name:'Harbour', em:'⚓', a:'#8fd3ff' },
  { id:'summit',  name:'Summit',  em:'🏔️', a:'#cdb4f6' },
  { id:'orchard', name:'Orchard', em:'🍎', a:'#ffd8a8' },
  { id:'lagoon',  name:'Lagoon',  em:'🐚', a:'#ffc8dd' }
];
const isServer = id => SERVERS.some(s=>s.id===id);

const ok  = (res,data)=>res.json({ ok:true, ...data });
/* Everything under /api needs Postgres except these two, which read no
   tables — so the game can still say honestly what is up and what rooms
   exist even when the database is not. */
const NO_DB_NEEDED = ['/health','/servers'];
app.use('/api',(req,res,next)=>{
  if(!db.ready && !NO_DB_NEEDED.includes(req.path))
    return res.status(503).json({ ok:false, error:'Sign-in is not connected yet (no database).' });
  next();
});
app.get('/api/health',(req,res)=>res.json({ ok:true, db:db.ready }));
/* what rooms exist and how busy each is. Above the database gate on purpose:
   it reads no tables, so the browser still lists rooms if Postgres is down. */
app.get('/api/servers',(req,res)=>{
  const n=headcount();
  res.json({ ok:true, servers: SERVERS.map(s=>({ ...s, count:n[s.id]||0 })) });
});
const bad = (res,code,msg)=>res.status(code).json({ ok:false, error:msg });

/* simple in-memory rate limit, enough to stop a bored student brute-forcing */
const attempts = new Map();
function rateLimited(key, max=12, windowMs=60000){
  const now=Date.now(), rec=attempts.get(key)||{n:0,t:now};
  if(now-rec.t>windowMs){ rec.n=0; rec.t=now; }
  rec.n++; attempts.set(key,rec);
  return rec.n>max;
}

const clean = s => String(s||'').trim();
const validUser = u => /^[a-zA-Z0-9_.-]{3,20}$/.test(u);
const validName = n => n.length>=1 && n.length<=16;

/* ----------------------------------------------------------- accounts */
app.post('/api/register', async (req,res)=>{
  try{
    const username = clean(req.body.username).toLowerCase();
    const password = String(req.body.password||'');
    const display  = clean(req.body.display) || username;
    if(!validUser(username)) return bad(res,400,'Username: 3-20 letters, numbers, . _ -');
    if(password.length<6)    return bad(res,400,'Password must be at least 6 characters');
    if(!validName(display))  return bad(res,400,'Display name must be 1-16 characters');
    const dupe = await db.q('SELECT 1 FROM users WHERE username=$1',[username]);
    if(dupe.rows.length)     return bad(res,409,'That username is taken');
    const { salt, pass_hash } = auth.makeHash(password);
    const r = await db.q(
      `INSERT INTO users (username,pass_hash,salt,role,display)
       VALUES ($1,$2,$3,'student',$4) RETURNING id,username,display,role,progress`,
      [username,pass_hash,salt,display]);
    const u = r.rows[0];
    auth.setCookie(res,{ id:u.id, role:u.role });
    ok(res,{ user:u });
  }catch(e){ console.error(e); bad(res,500,'Could not create that account'); }
});

app.post('/api/login', async (req,res)=>{
  try{
    const username = clean(req.body.username).toLowerCase();
    const password = String(req.body.password||'');
    if(rateLimited('login:'+(req.ip||'')+username)) return bad(res,429,'Too many tries — wait a minute');
    const r = await db.q('SELECT * FROM users WHERE username=$1',[username]);
    const u = r.rows[0];
    if(!u || !auth.verify(password,u.salt,u.pass_hash)) return bad(res,401,'Wrong username or password');
    auth.setCookie(res,{ id:u.id, role:u.role });
    ok(res,{ user:{ id:u.id, username:u.username, display:u.display, role:u.role,
                    progress:u.progress } });
  }catch(e){ console.error(e); bad(res,500,'Could not sign in'); }
});

app.post('/api/logout',(req,res)=>{ auth.clearCookie(res); ok(res,{}); });

app.get('/api/me', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  const r = await db.q('SELECT id,username,display,role,progress FROM users WHERE id=$1',[s.id]);
  if(!r.rows.length) return bad(res,401,'not signed in');
  ok(res,{ user:r.rows[0] });
});

app.post('/api/progress', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  const progress = req.body.progress||{};
  await db.q('UPDATE users SET progress=$1 WHERE id=$2',[JSON.stringify(progress), s.id]);
  ok(res,{});
});

/* ------------------------------------------------------------ teacher */
async function requireTeacher(req,res){
  const s = auth.fromReq(req);
  if(!s) { bad(res,401,'not signed in'); return null; }
  const r = await db.q('SELECT id,username,display,role FROM users WHERE id=$1',[s.id]);
  const u = r.rows[0];
  if(!u || u.role!=='teacher'){ bad(res,403,'teachers only'); return null; }
  return u;
}

app.post('/api/teacher/register', async (req,res)=>{
  try{
    const codeOK = process.env.TEACHER_CODE && clean(req.body.teacherCode)===process.env.TEACHER_CODE;
    if(!codeOK) return bad(res,403,'Wrong teacher code');
    const username = clean(req.body.username).toLowerCase();
    const password = String(req.body.password||'');
    if(!validUser(username)) return bad(res,400,'Username: 3-20 letters, numbers, . _ -');
    if(password.length<8)    return bad(res,400,'Teacher password must be at least 8 characters');
    const dupe = await db.q('SELECT 1 FROM users WHERE username=$1',[username]);
    if(dupe.rows.length) return bad(res,409,'That username is taken');
    const { salt, pass_hash } = auth.makeHash(password);
    const r = await db.q(
      `INSERT INTO users (username,pass_hash,salt,role,display) VALUES ($1,$2,$3,'teacher',$4)
       RETURNING id,username,display,role`, [username,pass_hash,salt,clean(req.body.display)||username]);
    auth.setCookie(res,{ id:r.rows[0].id, role:'teacher' });
    ok(res,{ user:r.rows[0] });
  }catch(e){ console.error(e); bad(res,500,'Could not create that account'); }
});

/* No classes to build any more, so a teacher sees the whole lab: every
   student who has signed up, every room and who is standing in it, and the
   recent chat across all of them. */
app.get('/api/teacher/overview', async (req,res)=>{
  const u = await requireTeacher(req,res); if(!u) return;
  const students = await db.q(
    `SELECT id,username,display,progress,muted_until FROM users
     WHERE role='student' ORDER BY display`);
  const msgs = await db.q(
    `SELECT id,server,user_id,display,text,hidden,created_at FROM messages
     ORDER BY id DESC LIMIT 120`);
  const n=headcount();
  ok(res,{ servers: SERVERS.map(s=>({ ...s, count:n[s.id]||0 })),
           students:students.rows, messages:msgs.rows.reverse() });
});

app.post('/api/teacher/mute', async (req,res)=>{
  const u = await requireTeacher(req,res); if(!u) return;
  const { userId, minutes } = req.body;
  const until = minutes>0 ? new Date(Date.now()+minutes*60000) : null;
  await db.q('UPDATE users SET muted_until=$1 WHERE id=$2',[until,userId]);
  // enforce on the open connection too: without this the mute is advisory and
  // a student whose client ignores it keeps talking
  for(const [,p] of live) if(p.id===Number(userId)) p.mutedUntil = until ? until.getTime() : 0;
  send(userId,{ t:'muted', until: until? until.getTime():0 });
  ok(res,{});
});

app.post('/api/teacher/hide', async (req,res)=>{
  const u = await requireTeacher(req,res); if(!u) return;
  await db.q('UPDATE messages SET hidden=true WHERE id=$1',[req.body.id]);
  broadcastAll({ t:'unsay', id:req.body.id });
  ok(res,{});
});

/* Clear one room, or leave the server out to clear the lot. Messages are
   hidden rather than deleted so an incident can still be looked at after. */
app.post('/api/teacher/clear', async (req,res)=>{
  const u = await requireTeacher(req,res); if(!u) return;
  const only = clean(req.body.server);
  if(only && !isServer(only)) return bad(res,400,'No such server');
  if(only) await db.q('UPDATE messages SET hidden=true WHERE server=$1',[only]);
  else     await db.q('UPDATE messages SET hidden=true');
  if(only) broadcastRoom(only,{ t:'clear' });
  else     broadcastAll({ t:'clear' });
  ok(res,{});
});

/* ------------------------------------------------- free play + chat */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path:'/ws' });
const live = new Map();   // ws -> {id, display, server, role, x,z,yaw, mutedUntil}

/* `server` is null until the client picks a room, so an unjoined socket is
   simply in no room and hears nothing — no accidental cross-posting. */
function broadcastRoom(server, obj, except){
  if(!server) return;
  const raw = JSON.stringify(obj);
  for(const [ws,p] of live) if(p.server===server && ws!==except && ws.readyState===1) ws.send(raw);
}
function broadcastAll(obj){
  const raw = JSON.stringify(obj);
  for(const [ws] of live) if(ws.readyState===1) ws.send(raw);
}
function send(userId,obj){
  const raw=JSON.stringify(obj);
  for(const [ws,p] of live) if(p.id===userId && ws.readyState===1) ws.send(raw);
}
function roster(server){
  const out=[];
  for(const [,p] of live) if(p.server===server && p.role==='student')
    out.push({ id:p.id, display:p.display, x:p.x, z:p.z, yaw:p.yaw, char:p.char });
  return out;
}
function headcount(){
  const n={}; SERVERS.forEach(s=>n[s.id]=0);
  for(const [,p] of live) if(p.server && n[p.server]!==undefined) n[p.server]++;
  return n;
}

wss.on('connection', async (ws, req)=>{
  const s = auth.fromReq(req);
  if(!s){ ws.close(4001,'sign in first'); return; }
  const r = await db.q('SELECT id,display,role,muted_until FROM users WHERE id=$1',[s.id]);
  const u = r.rows[0];
  if(!u){ ws.close(4001,'unknown user'); return; }
  live.set(ws,{ id:u.id, display:u.display, server:null, role:u.role,
                x:0, z:0, yaw:0, char:'a',
                mutedUntil: u.muted_until? new Date(u.muted_until).getTime():0 });
  ws.send(JSON.stringify({ t:'welcome', you:{id:u.id,display:u.display,role:u.role} }));

  ws.on('message', async raw=>{
    let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    const p = live.get(ws); if(!p) return;

    if(m.t==='join'){
      const want=String(m.server||'');
      if(!isServer(want)){ ws.send(JSON.stringify({ t:'sys', text:'No such server.' })); return; }
      if(p.server===want) return;
      if(p.server) broadcastRoom(p.server,{ t:'left', id:p.id, display:p.display }, ws);
      p.server=want;
      const recent = await db.q(
        `SELECT id,display,text FROM messages WHERE server=$1 AND hidden=false
         ORDER BY id DESC LIMIT 40`,[want]);
      ws.send(JSON.stringify({ t:'room', server:want, history:recent.rows.reverse() }));
      broadcastRoom(want,{ t:'joined', display:p.display }, ws);
      return;
    }
    if(m.t==='leave'){
      if(p.server) broadcastRoom(p.server,{ t:'left', id:p.id, display:p.display }, ws);
      p.server=null; return;
    }
    if(m.t==='pos'){
      if(!p.server) return;
      p.x=+m.x||0; p.z=+m.z||0; p.yaw=+m.yaw||0;
      if(typeof m.char==='string' && /^[a-r]$/.test(m.char)) p.char=m.char;
      return;
    }
    if(m.t==='chat'){
      const text = String(m.text||'').slice(0,160).trim();
      if(!text) return;
      if(p.mutedUntil && Date.now()<p.mutedUntil){
        ws.send(JSON.stringify({ t:'sys', text:'You are muted right now.' })); return;
      }
      if(rateLimited('chat:'+p.id, 8, 10000)){
        ws.send(JSON.stringify({ t:'sys', text:'Slow down a little.' })); return;
      }
      if(!p.server) return;
      const ins = await db.q(
        `INSERT INTO messages (server,user_id,display,text) VALUES ($1,$2,$3,$4) RETURNING id,created_at`,
        [p.server,p.id,p.display,text]);
      const out = { t:'chat', id:ins.rows[0].id, from:p.display, userId:p.id, text };
      broadcastRoom(p.server,out,ws);       // everyone else…
      ws.send(JSON.stringify(out));          // …then the sender, exactly once
      return;
    }
  });

  ws.on('close', ()=>{
    const p=live.get(ws); live.delete(ws);
    if(p) broadcastRoom(p.server,{ t:'left', id:p.id, display:p.display });
  });
});

/* 12 times a second, tell everyone in a room where everyone else is */
setInterval(()=>{
  const rooms=new Set(); for(const [,p] of live) if(p.server) rooms.add(p.server);
  for(const r of rooms) broadcastRoom(r,{ t:'players', players:roster(r) });
}, 80);

const PORT = process.env.PORT || 3000;
db.init()
  .catch(e=>console.error('DB init failed — running without accounts:', e.message))
  .finally(()=>server.listen(PORT,()=>
    console.log('Mission: Linux on '+PORT+' (database '+(db.ready?'connected':'OFFLINE')+')')));
