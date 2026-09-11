/* =====================================================================
   Mission: Linux — server
   Serves the game, handles sign-in, saves progress, and runs the shared
   rooms: player presence plus chat that a teacher can watch, mute and
   clear in real time. Chat is never stored — a room that empties forgets
   every word of it.

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
const mech = require('./mechmatch');
const mecha = require('./mechalobby');
const ARENA_HZ = require('../public/mechaarena.js').RULES.hz;

const app = express();
/* Sixteen kilobytes is the right ceiling for everything this server took
   before the arcade: a name, a password, a line of chat, a program of a
   couple of dozen blocks. A published GAME is a whole project — every
   object, every script, every list — and a good one from a determined
   nine-year-old is bigger than that. It gets its own limit on its own
   route rather than lifting the ceiling on sign-in and chat, which have
   no business ever being that large. */
app.use(express.json({ limit:'16kb' }));
const bigJson = express.json({ limit:'320kb' });
/* Flight School also ships as a standalone site with no account and no
   network — see flightschool/README.md. It is served from here too, so a
   teacher who is already in KORO has a link to hand out rather than a
   second deploy to keep alive. Same rules: code always revalidates. */
app.use('/flightschool', express.static(path.join(__dirname,'..','flightschool'), {
  etag:true,
  setHeaders(res,file){
    if(/\.(js|css|html)$/.test(file)) res.setHeader('Cache-Control','no-cache');
    else res.setHeader('Cache-Control','public, max-age=86400');
  }
}));

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
const OBJ_CAP = 60;          // one person cannot fill a room with ten thousand cubes

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

/* ======================================================== the arcade
   Games are made in Free Play, with the editor that is already there, and
   published here so somebody else can play them.

   EVERY STRING A CHILD WROTE IS CAPPED AND STORED AS TEXT. Titles and
   notes are shown to other children, so the browser renders them with
   textContent and the server never trusts a length. The project itself is
   JSON and is never executed here — the server stores it and hands it
   back; the only thing that runs it is the same VM that made it. */
const CAP = (v,n) => String(v==null?'':v).slice(0,n).trim();
const STARS = v => Math.max(1, Math.min(5, Math.round(+v||0)));

/* What a cabinet shows without opening it. The project is deliberately
   NOT in this list — it is the big half of a game and the arcade shows
   thirty of them at once. */
const SHELF = `g.id, g.title, g.blurb, g.stage, g.plays, g.author_id,
               u.display AS author, g.updated_at,
               COALESCE(v.votes,0)::int AS votes,
               COALESCE(ROUND(v.avg::numeric,1),0)::float AS stars`;
const SHELF_FROM = `FROM games g
  JOIN users u ON u.id=g.author_id
  LEFT JOIN (SELECT game_id, COUNT(*) AS votes, AVG(stars) AS avg
             FROM game_votes WHERE hidden=false GROUP BY game_id) v ON v.game_id=g.id`;

app.get('/api/arcade', async (req,res)=>{
  try{
    const r = await db.q(`SELECT ${SHELF} ${SHELF_FROM}
      WHERE g.hidden=false ORDER BY g.updated_at DESC LIMIT 60`);
    ok(res,{ games:r.rows });
  }catch(e){ console.error(e); bad(res,500,'The arcade is not answering'); }
});

app.get('/api/arcade/:id', async (req,res)=>{
  try{
    const id=Number(req.params.id)||0;
    const r = await db.q(`SELECT ${SHELF}, g.project ${SHELF_FROM}
      WHERE g.id=$1 AND g.hidden=false`,[id]);
    if(!r.rows.length) return bad(res,404,'No such game');
    const notes = await db.q(
      `SELECT v.stars, v.note, u.display FROM game_votes v
       JOIN users u ON u.id=v.user_id
       WHERE v.game_id=$1 AND v.hidden=false AND v.note<>''
       ORDER BY v.created_at DESC LIMIT 20`,[id]);
    ok(res,{ game:r.rows[0], notes:notes.rows });
  }catch(e){ console.error(e); bad(res,500,'Could not open that game'); }
});

/* Publish, or republish. An author has one cabinet per title rather than a
   new one per save — a class of thirty pressing PUBLISH after every change
   is a wall of the same game otherwise. */
app.post('/api/arcade', bigJson, async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  try{
    const title = CAP(req.body.title, 40);
    const blurb = CAP(req.body.blurb, 120);
    const stage = req.body.stage==='flat' ? 'flat' : 'world';
    const project = req.body.project;
    if(!title) return bad(res,400,'Give your game a name');
    if(!project || !Array.isArray(project.actors) || !project.actors.length)
      return bad(res,400,'There is nothing in this project yet');
    if(JSON.stringify(project).length > 300000)
      return bad(res,400,'That project is too big to publish');
    if(rateLimited('pub:'+s.id, 20, 60000)) return bad(res,429,'Slow down a little');
    const mine = await db.q(
      'SELECT id FROM games WHERE author_id=$1 AND lower(title)=lower($2)',[s.id,title]);
    if(mine.rows.length){
      const r = await db.q(
        `UPDATE games SET blurb=$1, stage=$2, project=$3, hidden=false, updated_at=now()
         WHERE id=$4 RETURNING id`,[blurb,stage,JSON.stringify(project),mine.rows[0].id]);
      return ok(res,{ id:r.rows[0].id, updated:true });
    }
    const r = await db.q(
      `INSERT INTO games (author_id,title,blurb,stage,project)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [s.id,title,blurb,stage,JSON.stringify(project)]);
    ok(res,{ id:r.rows[0].id, updated:false });
  }catch(e){ console.error(e); bad(res,500,'Could not publish that'); }
});

app.get('/api/arcade/mine/list', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  try{
    const r = await db.q(`SELECT ${SHELF} ${SHELF_FROM}
      WHERE g.author_id=$1 ORDER BY g.updated_at DESC`,[s.id]);
    ok(res,{ games:r.rows });
  }catch(e){ console.error(e); bad(res,500,'Could not read your games'); }
});

app.post('/api/arcade/:id/play', async (req,res)=>{
  try{
    await db.q('UPDATE games SET plays=plays+1 WHERE id=$1 AND hidden=false',
               [Number(req.params.id)||0]);
    ok(res,{});
  }catch(e){ bad(res,500,'no'); }
});

/* A rating and, if they want, one line about why. Voting on your own game
   is not a thing — it is the one vote that means nothing. */
app.post('/api/arcade/:id/rate', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  try{
    const id=Number(req.params.id)||0;
    const g = await db.q('SELECT author_id FROM games WHERE id=$1 AND hidden=false',[id]);
    if(!g.rows.length) return bad(res,404,'No such game');
    if(g.rows[0].author_id===s.id) return bad(res,400,'You cannot rate your own game');
    if(rateLimited('rate:'+s.id, 30, 60000)) return bad(res,429,'Slow down a little');
    await db.q(
      `INSERT INTO game_votes (game_id,user_id,stars,note) VALUES ($1,$2,$3,$4)
       ON CONFLICT (game_id,user_id)
       DO UPDATE SET stars=EXCLUDED.stars, note=EXCLUDED.note, created_at=now()`,
      [id, s.id, STARS(req.body.stars), CAP(req.body.note,140)]);
    ok(res,{});
  }catch(e){ console.error(e); bad(res,500,'Could not save that'); }
});

/* Taking it down. The author can, because it is theirs; a teacher can,
   because thirty of these are going up in a room they are responsible
   for. Hidden rather than deleted: a teacher who hides the wrong one
   should be able to put it back. */
app.post('/api/arcade/:id/hide', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  try{
    const id=Number(req.params.id)||0;
    const me = await db.q('SELECT role FROM users WHERE id=$1',[s.id]);
    const teacher = me.rows.length && me.rows[0].role==='teacher';
    const hidden = req.body.hidden!==false;
    const r = await db.q(
      teacher ? 'UPDATE games SET hidden=$2 WHERE id=$1 RETURNING id'
              : 'UPDATE games SET hidden=$2 WHERE id=$1 AND author_id=$3 RETURNING id',
      teacher ? [id,hidden] : [id,hidden,s.id]);
    if(!r.rows.length) return bad(res,403,'Not yours to take down');
    ok(res,{});
  }catch(e){ console.error(e); bad(res,500,'Could not do that'); }
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
  /* only what is being said right now: rooms that emptied kept nothing */
  const msgs = [];
  for(const [server,log] of chats) for(const c of log)
    msgs.push({ id:c.id, server, user_id:c.userId, display:c.display,
                text:c.text, hidden:c.hidden, created_at:new Date(c.at).toISOString() });
  msgs.sort((a,b)=>a.id-b.id);
  const n=headcount();
  ok(res,{ servers: SERVERS.map(s=>({ ...s, count:n[s.id]||0 })),
           students:students.rows, messages:msgs.slice(-120) });
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
  const id = Number(req.body.id);
  /* hidden, not spliced out: the teacher can still see what was said for as
     long as the room has somebody in it */
  for(const [,log] of chats) for(const c of log) if(c.id===id) c.hidden=true;
  broadcastAll({ t:'unsay', id });
  ok(res,{});
});

/* Clear one room, or leave the server out to clear the lot. Nothing was
   written down, so clearing is simply forgetting. */
app.post('/api/teacher/clear', async (req,res)=>{
  const u = await requireTeacher(req,res); if(!u) return;
  const only = clean(req.body.server);
  if(only && !isServer(only)) return bad(res,400,'No such server');
  if(only) chats.delete(only);
  else     chats.clear();
  if(only) broadcastRoom(only,{ t:'clear' });
  else     broadcastAll({ t:'clear' });
  ok(res,{});
});

/* ------------------------------------------------- free play + chat */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path:'/ws' });
const live = new Map();   // ws -> {id, display, server, role, x,z,yaw, mutedUntil}
/* Who is standing in the Gym with a program in their hand, one room at a
   time. It holds programs, not sockets, so a match is decided by what was
   submitted rather than by who is still connected to watch it. */
const lobby = new mech.Lobby();
/* And the live one. It is handed the two ways it can reach people and
   knows nothing else about sockets; the timer that steps it is below. */
const arena = new mecha.Arena({
  send:(id,msg)=>send(id,msg),
  room:(server,msg)=>broadcastRoom(server,msg)
});

/* Chat is kept in memory and only while somebody is standing in the room.
   Nothing goes to Postgres, and an empty room forgets everything it heard:
   the moment the last person walks out the log goes with them, so the next
   arrival gets a silent room rather than yesterday's conversation. A restart
   wipes the lot for the same reason. */
const chats = new Map();  // server id -> [{id, userId, display, text, hidden, at}]
let nextMsgId = 1;
const CHAT_KEEP = 40;     // how far back somebody joining can read

function occupied(server){
  for(const [,p] of live) if(p.server===server) return true;
  return false;
}
/* Call with the room somebody has just left — including on disconnect. */
function forgetIfEmpty(server){
  if(server && !occupied(server)) chats.delete(server);
}

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
    out.push({ id:p.id, display:p.display, x:p.x, y:p.y, z:p.z,
               yaw:p.yaw, pit:p.pit,
               char:p.char, act:p.act, ride:p.ride, at:p.at });
  return out;
}
/* Where somebody is standing: the planet they are out on, or the room they
   have walked into. Everyone else needs it to know whether to draw them at
   all — indoor coordinates painted onto a planet put a classmate in a field
   they are nowhere near — and the ones the room has a word for are said out
   loud, once, when they change. Anywhere else is simply away: they vanish,
   and nothing is announced. */
const WENT = { hub:'outside', home:'outside', arena:'outside', workshop:'workshop',
               house:'house', counter:'counter', mission:'mission', gym:'gym',
               space:'space' };
function moveTo(p, raw){
  const at = (typeof raw==='string' && /^[a-z_]{1,16}$/.test(raw)) ? raw : null;
  if(p.at===at) return;
  p.at=at;
  const where = WENT[at] || null;
  if(!where) return;                 // somewhere with no name: they simply go
  // arriving on the planet for the first time is "joined", which the room has
  // already said — only a return from somewhere is worth a second line
  const first = p.went===null && where==='outside';
  if(where!==p.went && !first && p.server)
    broadcastRoom(p.server, { t:'moved', display:p.display, where });
  p.went = where;
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
                // 's' is the character the browser starts everybody on, so a
                // roster read before their first 'pos' shows what they wear
                x:0, y:0, z:0, yaw:0, pit:0, char:'s', act:null, ride:null,
                at:null, went:null, objs:new Map(),
                mutedUntil: u.muted_until? new Date(u.muted_until).getTime():0 });
  ws.send(JSON.stringify({ t:'welcome', you:{id:u.id,display:u.display,role:u.role} }));

  ws.on('message', async raw=>{
    let m; try{ m=JSON.parse(raw); }catch(e){ return; }
    const p = live.get(ws); if(!p) return;

    if(m.t==='join'){
      const want=String(m.server||'');
      if(!isServer(want)){ ws.send(JSON.stringify({ t:'sys', text:'No such server.' })); return; }
      /* The objects we were holding belonged to the room — and the mission —
         being left. Drop them before anything else, and tell the room, or a
         newcomer is handed a set of objects that stopped existing: the ball
         somebody swapped for a car turns up in the new room as a car. A join
         to the room we are already in is a mission change and counts. */
      if(p.objs.size){
        p.objs.clear();
        broadcastRoom(p.server,{ t:'objs', from:p.id, full:true, set:[] }, ws);
      }
      if(p.server===want) return;
      lobby.cancel(p.id);          // you cannot wait in a Gym you have left
      arena.leave(p.id);
      const was = p.server;
      if(was) broadcastRoom(was,{ t:'left', id:p.id, display:p.display }, ws);
      p.server=want;
      forgetIfEmpty(was);
      const history = (chats.get(want)||[]).filter(c=>!c.hidden)
        .map(c=>({ id:c.id, display:c.display, text:c.text }));
      ws.send(JSON.stringify({ t:'room', server:want, history }));
      /* the room is already full of other people's objects — hand the newcomer
         the lot at once, rather than waiting for each owner's next change */
      for(const [,q] of live)
        if(q!==p && q.server===want && q.objs.size)
          ws.send(JSON.stringify({ t:'objs', from:q.id, full:true, set:[...q.objs.values()] }));
      broadcastRoom(want,{ t:'joined', display:p.display }, ws);
      return;
    }
    if(m.t==='leave'){
      const was = p.server;
      lobby.cancel(p.id); arena.leave(p.id);
      if(was) broadcastRoom(was,{ t:'left', id:p.id, display:p.display }, ws);
      p.server=null; p.objs.clear();
      forgetIfEmpty(was);
      return;
    }
    if(m.t==='pos'){
      if(!p.server) return;
      p.x=+m.x||0; p.z=+m.z||0; p.yaw=+m.yaw||0;
      /* THE THIRD ONE, for space. On the ground two numbers and a heading
         are the whole of where somebody is — the ground supplies the rest.
         Out between the planets there is no ground, so height and pitch
         have to travel too, or a classmate flying above you is a classmate
         flying beside you. */
      p.y=+m.y||0; p.pit=+m.pit||0;
      /* THE FORMAT, NOT THE ROSTER.  This used to spell out the letters
         the game shipped with — and when Kyle and Mia were added as `s`
         and `t` the test silently dropped them, so everybody wearing the
         DEFAULT character was relayed to the room as the `a` below and
         appeared to their classmates as somebody else entirely.  The
         browser decides which model a letter names and catches one it
         does not know, exactly as it does for `ride` underneath, so the
         only thing worth checking here is that it is a single letter. */
      if(typeof m.char==='string' && /^[a-z]$/.test(m.char)) p.char=m.char;
      // the car they are driving, if any — the browser decides which model that
      // names, so an unknown id simply draws nothing
      /* WHAT THEIR BODY IS DOING: the name of the clip it is playing. Only
         the things their movement cannot show travel this way — a jump and
         an emote — and the browser reads it exactly as it reads `ride`
         below, so a name it does not know simply draws nothing new. */
      p.act = (typeof m.act==='string' && /^[a-z][a-z0-9_]{0,15}$/.test(m.act)) ? m.act : null;
      p.ride = (typeof m.ride==='string' && /^[a-z_]{1,16}$/.test(m.ride)) ? m.ride : null;
      moveTo(p, m.at);
      return;
    }
    if(m.t==='place'){ moveTo(p, m.at); return; }
    /* ------------------------------------------------------- the Gym
       A student submits a program and either waits or gets a whole
       match back. The fight is decided here and only the inputs travel,
       so both browsers redraw the same battle turn for turn and neither
       of them gets to decide who won. */
    if(m.t==='mech'){
      if(m.op==='cancel'){
        if(lobby.cancel(p.id)) ws.send(JSON.stringify({ t:'mech', op:'cancelled' }));
        return;
      }
      if(m.op!=='queue') return;
      if(!p.server){ ws.send(JSON.stringify({ t:'mech', op:'error',
        message:'You are not in a room.' })); return; }
      if(rateLimited('mech:'+p.id, 20, 60000)){
        ws.send(JSON.stringify({ t:'mech', op:'error',
          message:'Too many deploys — wait a moment.' })); return; }
      /* A program is a couple of dozen small blocks. Anything the size of
         a novel is not one, and is not worth handing to the compiler. */
      if(JSON.stringify(m.program||null).length > 12000){
        ws.send(JSON.stringify({ t:'mech', op:'error',
          message:'That program is too big to send.' })); return; }

      const r = lobby.add(p.server,
        { id:p.id, name:p.display, chassis:String(m.chassis||''), program:m.program });

      if(r.status==='waiting'){
        ws.send(JSON.stringify({ t:'mech', op:'waiting' }));
        // so the rest of the room knows there is somebody to go and fight
        broadcastRoom(p.server, { t:'mech', op:'open', name:p.display }, ws);
        return;
      }
      if(r.status==='rejected' || r.status==='error'){
        ws.send(JSON.stringify({ t:'mech', op:'rejected',
          errors:r.errors || [{ msg:r.message }] }));
        return;
      }
      if(r.status==='rejected-pair'){
        // tell each side only about its own program
        for(const side of ['A','B']){
          const who=r.sides[side];
          const mine=(r.rejected.find(x=>x.side===side)||{}).errors||[];
          send(who, mine.length
            ? { t:'mech', op:'rejected', errors:mine }
            : { t:'mech', op:'waiting' });
        }
        return;
      }
      if(r.status==='matched'){
        const M=r.match;
        for(const side of ['A','B'])
          send(M[side].id, { t:'mech', op:'match', you:side,
            seed:M.seed, arena:M.arena, rules:M.rules, result:M.result,
            A:{ name:M.A.name, chassis:M.A.chassis, program:M.A.program },
            B:{ name:M.B.name, chassis:M.B.chassis, program:M.B.program } });
        /* AND THE ROOM CAN WATCH IT. A match is only its inputs — two
           programs, a floor and a seed — so this is a kilobyte or so, not
           a video, and anybody who replays it gets the identical fight.
           The two who fought it already have it; they ignore their own.

           It reveals nothing that was private: after a match both
           programs are readable in the other's battle log anyway, and
           this only ever goes out about a fight that has finished. */
        broadcastRoom(p.server, { t:'fought', a:M.A.name, b:M.B.name,
          winner:M.result.winner, turns:M.result.turns,
          watch:{ seed:M.seed, arena:M.arena, rules:M.rules, result:M.result,
                  A:{ name:M.A.name, chassis:M.A.chassis, program:M.A.program },
                  B:{ name:M.B.name, chassis:M.B.chassis, program:M.B.program } } });
      }
      return;
    }
    /* ------------------------------------------------- the live arena
       Three messages and nothing else: put me in the queue, here is what
       I am holding down, take me out. Everything about who hit whom is
       decided by the server and sent back. */
    if(m.t==='mecha'){
      if(m.op==='input'){ arena.input(p.id, m.i||{}); return; }
      if(m.op==='cancel'){
        if(arena.cancel(p.id)) ws.send(JSON.stringify({ t:'mecha', op:'cancelled' }));
        return;
      }
      if(m.op==='leave'){ arena.leave(p.id); return; }
      if(m.op!=='queue') return;
      if(!p.server){ ws.send(JSON.stringify({ t:'mecha', op:'error',
        message:'You are not in a room.' })); return; }
      if(rateLimited('mecha:'+p.id, 20, 60000)){
        ws.send(JSON.stringify({ t:'mecha', op:'error',
          message:'Too many deploys — wait a moment.' })); return; }
      const r=arena.join(p.server, { id:p.id, name:p.display, programs:m.programs });
      if(r.status==='waiting'){
        ws.send(JSON.stringify({ t:'mecha', op:'waiting' }));
        broadcastRoom(p.server, { t:'mecha', op:'open', name:p.display }, ws);
      } else if(r.status==='rejected'){
        ws.send(JSON.stringify({ t:'mecha', op:'rejected', errors:r.errors }));
      } else if(r.status==='error'){
        ws.send(JSON.stringify({ t:'mecha', op:'error', message:r.message }));
      }
      return;
    }
    /* Objects are relayed, not simulated: the owner's machine runs the scripts
       and says where things ended up. The server keeps the last word on each so
       a latecomer sees a room that is already furnished. */
    if(m.t==='objs'){
      if(!p.server) return;
      const set=Array.isArray(m.set)? m.set.slice(0,60) : [];
      const del=Array.isArray(m.del)? m.del.slice(0,60) : [];
      if(m.full) p.objs.clear();
      for(const id of del) p.objs.delete(id);
      for(const o of set){
        if(!o || o.i===undefined) continue;
        if(p.objs.has(o.i) || p.objs.size<OBJ_CAP) p.objs.set(o.i,o);
      }
      if(set.length||del.length||m.full)
        broadcastRoom(p.server,{ t:'objs', from:p.id, full:!!m.full, set, del }, ws);
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
      const out = { t:'chat', id:nextMsgId++, from:p.display, userId:p.id, text };
      const log = chats.get(p.server) || [];
      log.push({ id:out.id, userId:p.id, display:p.display, text, hidden:false, at:Date.now() });
      if(log.length>CHAT_KEEP) log.splice(0, log.length-CHAT_KEEP);
      chats.set(p.server, log);
      broadcastRoom(p.server,out,ws);       // everyone else…
      ws.send(JSON.stringify(out));          // …then the sender, exactly once
      return;
    }
  });

  ws.on('close', ()=>{
    const p=live.get(ws); live.delete(ws);
    if(!p) return;
    lobby.cancel(p.id); arena.leave(p.id);
    broadcastRoom(p.server,{ t:'left', id:p.id, display:p.display });
    forgetIfEmpty(p.server);
  });
});

/* The arena's own heartbeat. Twenty times a second is the tick the
   simulation is written for; the interval is asked for the real gap so a
   busy server slows a fight down rather than getting it wrong. */
let arenaAt=Date.now();
setInterval(()=>{
  const now=Date.now(), dt=Math.min(0.1,(now-arenaAt)/1000);
  arenaAt=now;
  if(arena.running) arena.tick(dt);
}, 1000/ARENA_HZ);

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
