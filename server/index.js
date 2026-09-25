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
/* FIRST, BEFORE ANYTHING ELSE IS REQUIRED. db.js reads DATABASE_URL at
   load time and tutor.js reads the API key at load time, so a .env read
   any later than this line is a .env that did nothing. */
require('./env').load();

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const db = require('./db');
const auth = require('./auth');
const mech = require('./mechmatch');
const tutor = require('./tutor');
const npc = require('./npc');
const rooms = require('./chatrooms');

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
/* The tutor reads no tables either — it is a question, a key and an
   answer. It still wants to know WHO is asking, so it sits below the
   sign-in check but above the database one, and a school running the
   game without Postgres still gets it. */
const NO_DB_NEEDED = ['/health','/servers','/who','/tutor','/tutor/on','/npc','/npc/on'];
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

/* ===================================================== who else is here
   The server has always known this — `live` is every open socket, with the
   room it joined and the door it last walked through — and nothing ever
   showed it to anybody but a teacher. In a game whose whole multiplayer
   pitch is "your class is in here with you", not being able to find out
   who is in here with you is a strange gap.

   IT READS NO TABLES, so it sits above the database gate with /health and
   /servers: the honest answer to "who is about" does not depend on
   Postgres being up. It does need a signed-in cookie, which is checked
   from the HMAC alone — a public endpoint listing the display names of a
   room full of children is not a thing to ship.

   STUDENTS ONLY, which is the convention the in-world roster already
   follows: a teacher is not drawn as a body in the room either. Somebody
   watching a class is not another child to go and find. */
app.get('/api/who',(req,res)=>{
  if(!auth.fromReq(req)) return bad(res,401,'not signed in');
  const me = auth.fromReq(req);
  const mine = [];
  for(const [,p] of live){
    if(p.role!=='student') continue;
    mine.push({ id:p.id, display:p.display, char:p.char,
                server:p.server || null,
                /* Where they are in words the room has a name for. Anywhere
                   else is simply null — see moveTo(): a place with no name
                   is a place somebody has gone quietly, not a secret. */
                where: WENT[p.at] || null,
                riding: !!p.ride,
                you: p.id===me.id });
  }
  mine.sort((a,b)=>String(a.display).localeCompare(String(b.display)));
  const rooms = SERVERS.map(s=>({ ...s, people: mine.filter(p=>p.server===s.id) }));
  /* Signed in, socket open, no room picked yet. They are online and they
     are nowhere, and leaving them off the list makes the total lie. */
  const lobby = mine.filter(p=>!p.server);
  res.json({ ok:true, rooms, lobby, total:mine.length });
});

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

/* ------------------------------------------------------------ the phone
   Texting by username. Everything here is a plain request, not the socket:
   the live host is serverless and cannot hold a socket open, and a text is
   the one conversation that has to work when the other person is not even
   signed in — it waits in Postgres until they are. When there IS a socket
   (a host that keeps a process), the recipient is also told at once.

   THE RULES ARE THE ROOM CHAT'S RULES, because it is the same children:
   a muted student cannot text either, sending is rate limited, a message
   is 240 characters at most, a teacher can read every one and hide any
   one, and nothing is kept for longer than PHONE_KEEP_DAYS. */
const PHONE_MAX = 240;
const PHONE_KEEP_DAYS = 14;
let phoneSwept = 0;
async function phoneSweep(){
  if(Date.now()-phoneSwept < 3600e3) return;          // at most once an hour
  phoneSwept = Date.now();
  try{ await db.q(`DELETE FROM phone_messages WHERE created_at < now() - interval '${PHONE_KEEP_DAYS} days'`); }
  catch(e){ console.error('phone sweep', e.message); }
}
async function signedIn(req,res){
  const s = auth.fromReq(req);
  if(!s){ bad(res,401,'not signed in'); return null; }
  const r = await db.q('SELECT id,username,display,role,muted_until FROM users WHERE id=$1',[s.id]);
  if(!r.rows.length){ bad(res,401,'not signed in'); return null; }
  return r.rows[0];
}

/* The conversations: everybody you have texted or been texted by, newest
   first, with the last thing said and how many of theirs you have not
   read. */
app.get('/api/phone/threads', async (req,res)=>{
  try{
    const u = await signedIn(req,res); if(!u) return;
    phoneSweep();
    const r = await db.q(
      `SELECT m.id, m.from_id, m.to_id, m.text, m.read_at, m.created_at,
              o.username, o.display
         FROM phone_messages m
         JOIN users o ON o.id = CASE WHEN m.from_id=$1 THEN m.to_id ELSE m.from_id END
        WHERE (m.from_id=$1 OR m.to_id=$1) AND m.hidden=false
        ORDER BY m.created_at DESC LIMIT 400`, [u.id]);
    const by = new Map();
    for(const m of r.rows){
      let th = by.get(m.username);
      if(!th){ th={ username:m.username, display:m.display, last:m.text,
                    lastMine:m.from_id===u.id, at:m.created_at, unread:0 };
               by.set(m.username, th); }
      if(m.to_id===u.id && !m.read_at) th.unread++;
    }
    ok(res,{ threads:[...by.values()] });
  }catch(e){ console.error(e); bad(res,500,'Could not open your messages'); }
});

/* One conversation, oldest first, and everything they sent you in it is
   now read. */
app.get('/api/phone/thread/:username', async (req,res)=>{
  try{
    const u = await signedIn(req,res); if(!u) return;
    const who = clean(req.params.username).toLowerCase();
    const o = (await db.q('SELECT id,username,display FROM users WHERE username=$1',[who])).rows[0];
    if(!o) return bad(res,404,'Nobody has that username');
    const r = await db.q(
      `SELECT id, from_id, text, created_at FROM phone_messages
        WHERE hidden=false AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1))
        ORDER BY created_at DESC LIMIT 100`, [u.id, o.id]);
    await db.q(`UPDATE phone_messages SET read_at=now()
                 WHERE to_id=$1 AND from_id=$2 AND read_at IS NULL`, [u.id, o.id]);
    ok(res,{ with:{ username:o.username, display:o.display },
             messages:r.rows.reverse().map(m=>({ id:m.id, mine:m.from_id===u.id,
                                                  text:m.text, at:m.created_at })) });
  }catch(e){ console.error(e); bad(res,500,'Could not open that conversation'); }
});

app.post('/api/phone/send', async (req,res)=>{
  try{
    const u = await signedIn(req,res); if(!u) return;
    const to = clean(req.body.to).toLowerCase().replace(/^@/,'');
    const text = String(req.body.text||'').replace(/\s+/g,' ').trim().slice(0, PHONE_MAX);
    if(!text) return bad(res,400,'Type a message first');
    if(u.muted_until && new Date(u.muted_until).getTime() > Date.now())
      return bad(res,403,'You are muted right now');
    if(rateLimited('phone:'+u.id, 10, 20000)) return bad(res,429,'Slow down a little');
    const o = (await db.q('SELECT id,username,display FROM users WHERE username=$1',[to])).rows[0];
    if(!o) return bad(res,404,'Nobody has that username');
    if(o.id===u.id) return bad(res,400,'That is you!');
    const r = await db.q(
      `INSERT INTO phone_messages (from_id,to_id,text) VALUES ($1,$2,$3)
       RETURNING id, created_at`, [u.id, o.id, text]);
    const msg = { id:r.rows[0].id, text, at:r.rows[0].created_at };
    // if they are here right now, their phone buzzes now rather than on its next look
    send(o.id, { t:'dm', from:u.username, display:u.display, ...msg });
    phoneSweep();
    ok(res,{ message:{ ...msg, mine:true }, with:{ username:o.username, display:o.display } });
  }catch(e){ console.error(e); bad(res,500,'Could not send that'); }
});

/* The badge: how many unread, and from whom the newest came. Asked every
   few seconds by every signed-in phone, so it is one small query. */
app.get('/api/phone/unread', async (req,res)=>{
  try{
    const u = await signedIn(req,res); if(!u) return;
    const r = await db.q(
      `SELECT m.id, o.username, o.display, m.text FROM phone_messages m
         JOIN users o ON o.id=m.from_id
        WHERE m.to_id=$1 AND m.read_at IS NULL AND m.hidden=false
        ORDER BY m.id DESC LIMIT 20`, [u.id]);
    ok(res,{ count:r.rows.length, latest:r.rows[0]||null });
  }catch(e){ console.error(e); bad(res,500,'Could not check'); }
});

/* Finding somebody to text: usernames that start with what you typed. */
app.get('/api/phone/find', async (req,res)=>{
  try{
    const u = await signedIn(req,res); if(!u) return;
    const q = clean(req.query.q).toLowerCase().replace(/^@/,'');
    if(q.length<2 || !/^[a-z0-9_.-]+$/.test(q)) return ok(res,{ people:[] });
    const r = await db.q(
      `SELECT username, display FROM users WHERE username LIKE $1 AND id<>$2
        ORDER BY username LIMIT 8`, [q+'%', u.id]);
    ok(res,{ people:r.rows });
  }catch(e){ console.error(e); bad(res,500,'Could not look'); }
});

/* The teacher's view of it: every recent text, who to whom, hidden or not. */
app.get('/api/teacher/texts', async (req,res)=>{
  const t = await requireTeacher(req,res); if(!t) return;
  try{
    const r = await db.q(
      `SELECT m.id, m.text, m.hidden, m.created_at,
              f.username AS from_user, f.display AS from_display,
              o.username AS to_user,   o.display AS to_display
         FROM phone_messages m JOIN users f ON f.id=m.from_id JOIN users o ON o.id=m.to_id
        ORDER BY m.id DESC LIMIT 200`);
    ok(res,{ texts:r.rows });
  }catch(e){ console.error(e); bad(res,500,'Could not load texts'); }
});
app.post('/api/teacher/texts/hide', async (req,res)=>{
  const t = await requireTeacher(req,res); if(!t) return;
  try{
    await db.q('UPDATE phone_messages SET hidden=$2 WHERE id=$1',[Number(req.body.id)||0, req.body.hidden!==false]);
    ok(res,{});
  }catch(e){ console.error(e); bad(res,500,'Could not do that'); }
});

/* ========================================================= chat rooms
   Places players own (server/chatrooms.js). Every request is signed in,
   and everything an owner may do is checked against the database from the
   session — the client saying "it's my room" counts for nothing. */
const roomStore = rooms.makeStore(db);
const crCount = id => { let n = 0; for (const [, p] of live) if (p.server === 'cr:' + id) n++; return n; };
const withCounts = list => list.map(r => ({ ...r, players: crCount(r.id) }));
/* Everybody inside room `id` for whom keep(userId) is false is sent back
   out: removed from the list, the room made private, or the room gone. */
function crKick(id, keep, reason) {
  const key = 'cr:' + id;
  for (const [ws, p] of live) if (p.server === key && !keep(p.id)) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ t:'crkick', id, reason }));
    broadcastRoom(key, { t:'left', id:p.id, display:p.display }, ws);
    p.server = null; p.objs.clear();
  }
  forgetIfEmpty(key);
}
async function roomUser(req, res) {
  const s = auth.fromReq(req);
  if (!s) { bad(res, 401, 'Sign in to use chat rooms — P → Your account.'); return null; }
  if (!rooms.on()) { bad(res, 503, 'Chat rooms are not set up on this server.'); return null; }
  return s;
}
/* The room, if `s` owns it; otherwise the answer has already gone. */
async function ownRoom(req, res, s) {
  const r = await roomStore.room(Number(req.params.id) || 0);
  if (!r) { bad(res, 404, 'No such room.'); return null; }
  if (r.owner_id !== s.id) { bad(res, 403, 'Only the owner can do that.'); return null; }
  return r;
}
const roomFail = (res, e) => { console.error('[rooms]', e && e.message ? e.message : e); bad(res, 500, 'Could not do that just now.'); };

app.get('/api/rooms', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  try {
    const [mine, invited, recent] = await Promise.all([roomStore.mine(s.id), roomStore.invited(s.id), roomStore.recent(s.id)]);
    ok(res, { mine:withCounts(mine), invited:withCounts(invited), recent:withCounts(recent), max:rooms.MAX_OWNED });
  } catch (e) { roomFail(res, e); }
});
app.get('/api/rooms/search', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  const q = String(req.query.q || '').trim().slice(0, 32);
  if (!q) return ok(res, { rooms:[] });
  try { ok(res, { rooms:withCounts(await roomStore.search(q, s.id)) }); } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  const name = rooms.cleanName(req.body.name);
  if (!name) return bad(res, 400, 'Give the room a name.');
  const access = rooms.ACCESS.includes(req.body.access) ? req.body.access : 'private';
  if (rateLimited('room:' + s.id, 10, 60000)) return bad(res, 429, 'Slow down a little.');
  try {
    if (await roomStore.countOwned(s.id) >= rooms.MAX_OWNED)
      return bad(res, 400, 'You have ' + rooms.MAX_OWNED + ' rooms already — delete one to make another.');
    const made = await roomStore.create(s.id, name, access, rooms.fromTemplate(String(req.body.template || 'empty')));
    ok(res, { room:rooms.view(await roomStore.room(made.id), s.id) });
  } catch (e) { roomFail(res, e); }
});
app.get('/api/rooms/:id', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  try {
    const r = await roomStore.room(Number(req.params.id) || 0);
    if (!r || !(await roomStore.canEnter(r, s.id))) return bad(res, 404, 'No such room — or it is not open to you.');
    const out = rooms.view(r, s.id);
    out.players = crCount(r.id);
    if (out.mine) out.members = await roomStore.members(r.id);
    ok(res, { room:out });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/enter', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  try {
    const r = await roomStore.room(Number(req.params.id) || 0);
    if (!r) return bad(res, 404, 'That room is gone.');
    if (!(await roomStore.canEnter(r, s.id)))
      return bad(res, 403, r.access === 'invited' ? 'That room is invite only — ask ' + r.owner_display + ' to add you.' : 'That room is private.');
    await roomStore.visit(s.id, r.id);
    const out = rooms.view(r, s.id);
    if (out.mine) out.members = await roomStore.members(r.id);
    ok(res, { room:out, server:'cr:' + r.id });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/save', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  if (JSON.stringify(req.body || {}).length > 60000) return bad(res, 413, 'That room is too big to save.');
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    const cur = typeof r.env === 'string' ? JSON.parse(r.env) : r.env;
    const env = rooms.cleanEnv(req.body.env, cur);
    const objects = rooms.cleanObjects(req.body.objects);
    await roomStore.save(r.id, env, objects);
    broadcastRoom('cr:' + r.id, { t:'crupdate', id:r.id });
    ok(res, { room:rooms.view(await roomStore.room(r.id), s.id) });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/rename', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  const name = rooms.cleanName(req.body.name);
  if (!name) return bad(res, 400, 'Give the room a name.');
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    await roomStore.rename(r.id, name);
    broadcastRoom('cr:' + r.id, { t:'crupdate', id:r.id });
    ok(res, { name });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/access', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  const access = req.body.access;
  if (!rooms.ACCESS.includes(access)) return bad(res, 400, 'Private, invited or public.');
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    await roomStore.setAccess(r.id, access);
    if (access !== 'public') {
      const allowed = new Set((await roomStore.members(r.id)).map(m => m.id));
      crKick(r.id, uid => uid === r.owner_id || allowed.has(uid), 'The owner closed the room.');
    }
    broadcastRoom('cr:' + r.id, { t:'crupdate', id:r.id });
    ok(res, { access });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/invite', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  const username = String(req.body.username || '').trim().toLowerCase();
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    const u = (await db.q('SELECT id,username,display FROM users WHERE username=$1', [username])).rows[0];
    if (!u) return bad(res, 404, 'Nobody is called @' + username + '.');
    if (u.id === s.id) return bad(res, 400, 'It is your room already.');
    await roomStore.addMember(r.id, u.id);
    send(u.id, { t:'crinvite', id:r.id, name:r.name, from:r.owner_display });
    ok(res, { members:await roomStore.members(r.id) });
  } catch (e) { roomFail(res, e); }
});
app.post('/api/rooms/:id/remove', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    const uid = Number(req.body.userId) || 0;
    await roomStore.removeMember(r.id, uid);
    if (r.access !== 'public') crKick(r.id, id => id !== uid, 'The owner took you off the list.');
    ok(res, { members:await roomStore.members(r.id) });
  } catch (e) { roomFail(res, e); }
});
app.delete('/api/rooms/:id', async (req, res) => {
  const s = await roomUser(req, res); if (!s) return;
  try {
    const r = await ownRoom(req, res, s); if (!r) return;
    crKick(r.id, () => false, 'The owner deleted the room.');
    await roomStore.remove(r.id);
    ok(res, {});
  } catch (e) { roomFail(res, e); }
});

/* ------------------------------------------------- free play + chat */
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path:'/ws' });
const live = new Map();   // ws -> {id, display, server, role, x,z,yaw, mutedUntil}
/* Who is standing in the Gym with a program in their hand, one room at a
   time. It holds programs, not sockets, so a match is decided by what was
   submitted rather than by who is still connected to watch it. */
const lobby = new mech.Lobby();


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
  if(server && !occupied(server)){ chats.delete(server); crLive.delete(server); }
}
/* A chat room's live half: which switch is up, which track is playing, when
   a robot was set running. Relayed and remembered while anybody is inside,
   so a latecomer walks into the room as it is; never written down. */
const crLive = new Map();  // 'cr:<id>' -> Map(objectId -> state)

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
      const cr=/^cr:(\d{1,10})$/.exec(want);
      if(cr){
        const id=Number(cr[1]);
        if(!rooms.on() || !db.ready){ ws.send(JSON.stringify({ t:'crkick', id, reason:'Chat rooms are off here.' })); return; }
        const r=await roomStore.room(id).catch(()=>null);
        if(!r){ ws.send(JSON.stringify({ t:'crkick', id, reason:'That room is gone.' })); return; }
        if(!(await roomStore.canEnter(r, p.id).catch(()=>false))){
          ws.send(JSON.stringify({ t:'crkick', id, reason:'That room is not open to you.' })); return; }
      } else if(!isServer(want)){ ws.send(JSON.stringify({ t:'sys', text:'No such server.' })); return; }
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
      const was = p.server;
      if(was) broadcastRoom(was,{ t:'left', id:p.id, display:p.display }, ws);
      p.server=want;
      forgetIfEmpty(was);
      const history = (chats.get(want)||[]).filter(c=>!c.hidden)
        .map(c=>({ id:c.id, display:c.display, text:c.text }));
      ws.send(JSON.stringify({ t:'room', server:want, history }));
      if(want.startsWith('cr:')){
        const states=[...(crLive.get(want)||new Map()).entries()].map(([o,s])=>({ o, s }));
        ws.send(JSON.stringify({ t:'cro_all', states, now:Date.now() }));
      }
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
      lobby.cancel(p.id);
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
      if(typeof m.char==='string' && /^[a-z]{1,12}$/.test(m.char)) p.char=m.char;
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
    if(m.t==='cro'){
      if(!p.server || !p.server.startsWith('cr:')) return;
      if(rateLimited('cro:'+p.id, 40, 10000)) return;
      const o=String(m.o||'');
      if(!/^[a-z0-9]{1,12}$/.test(o)) return;
      let st=(m.s && typeof m.s==='object' && !Array.isArray(m.s)) ? m.s : {};
      if(JSON.stringify(st).length>400) return;
      /* a robot set running is stamped with THIS clock, so every screen
         replays the same program from the same moment */
      if(st.run) st={ ...st, run:Date.now() };
      const map=crLive.get(p.server)||new Map();
      map.set(o,st); crLive.set(p.server,map);
      broadcastRoom(p.server,{ t:'cro', o, s:st, by:p.display, now:Date.now() });
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
    lobby.cancel(p.id);
    broadcastRoom(p.server,{ t:'left', id:p.id, display:p.display });
    forgetIfEmpty(p.server);
  });
});

/* NO ARENA HEARTBEAT ANY MORE. There was a timer here stepping live
   matches twenty times a second; the ring is one robot on a floor in one
   browser now, so there is nothing on this machine to step. It comes
   back with the fight. */

/* 12 times a second, tell everyone in a room where everyone else is.

   ONLY WHEN THIS PROCESS IS A SERVER. Required as a module — which is
   what a serverless host does, once per cold start, to get the Express
   app out of it — there is nobody in any room and never will be, because
   no socket can reach a function that only exists for the length of one
   request. A timer firing twelve times a second over an empty map for the
   life of every container is pure waste.

   AND "A SERVER" MEANS start(), NOT BEING THE MAIN MODULE. This used to ask
   require.main, which is only true for `npm start` — so `npm run dev` and
   the Mac app, which both require this file and call start(), ran a room
   in which nobody ever heard where anybody else was. */
let rosterT = null;
function rosters(){
  if(rosterT) return;
  rosterT = setInterval(()=>{
    const rooms=new Set(); for(const [,p] of live) if(p.server) rooms.add(p.server);
    for(const r of rooms) broadcastRoom(r,{ t:'players', players:roster(r) });
  }, 80);
}

/* ========================================================= the tutor
   Somebody to ask who will not do it for you. See server/tutor.js for
   what it is told and, more importantly, what it is told not to say.

   SIGNED IN, AND ONE QUESTION AT A TIME. An open endpoint that costs
   money per call is an open endpoint somebody will find; the session
   cookie the rest of the game already uses is the gate, and a plain
   per-user cooldown stops one bored child holding the key down. Neither
   is security in the serious sense — they are the two lines that keep a
   lab's bill looking like a lab's bill.

   NOTHING IS STORED. The conversation is in the browser tab. The server
   sees a question, streams an answer and forgets both. */
app.get('/api/tutor/on',(req,res)=>ok(res,{ tutor:tutor.on() }));

const LAST_ASK = new Map();            // user id -> when they last asked
const COOLDOWN = 1500;
app.post('/api/tutor', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'not signed in');
  if(!tutor.on()) return bad(res,503,'The tutor is not switched on here.');
  const now = Date.now(), last = LAST_ASK.get(s.id) || 0;
  if(now-last < COOLDOWN) return bad(res,429,'One at a time — try again in a moment.');
  LAST_ASK.set(s.id, now);

  const question = String(req.body.question||'').slice(0, tutor.MAX_ASK).trim();
  if(!question) return bad(res,400,'ask something');

  /* SERVER-SENT EVENTS, because a reply that arrives a word at a time is
     one a child will wait for. Headers go out before the first token so
     the browser opens the stream rather than buffering the lot. */
  res.writeHead(200,{
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-cache, no-transform',
    'Connection':'keep-alive',
    'X-Accel-Buffering':'no'
  });
  const send = (kind,data)=>res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
  /* WATCH THE RESPONSE, NOT THE REQUEST. `req` is a stream of the body,
     and for a POST it CLOSES as soon as that body has been read — about
     two milliseconds in, long before the student has gone anywhere. This
     was req.on('close'), so the flag was already true when the first
     token arrived: every frame was suppressed, the browser was handed an
     open stream with nothing in it, and the panel said "(no answer came
     back)". The response is the thing that closes when the client
     actually leaves. */
  let closed=false;
  res.on('close',()=>{ closed=true; });
  try{
    await tutor.ask({
      question,
      history: Array.isArray(req.body.history) ? req.body.history : [],
      context: req.body.context || {}
    }, chunk => { if(!closed) send('say', chunk); });
    if(!closed) send('done', {});
  }catch(e){
    /* The student is mid-question with a spinner on screen. Say
       something they can act on rather than leaving it turning. */
    const rate = e && (e.status===429 || e.status===529);
    if(!closed) send('fail', rate ? 'The tutor is busy — try again in a moment.'
                                  : 'The tutor could not answer just now.');
    if(!rate) console.error('[tutor]', e && e.message ? e.message : e);
  }
  res.end();
});

/* ============================================================ the npcs
   Kit, Ada and Volt, each a real conversation and each guarded on its own
   (server/npc.js). Signed in, like the tutor — a call costs money — and a
   short per-player limit on top so one player cannot hold the key down. */
app.get('/api/npc/on',(req,res)=>ok(res,{ npc:npc.on(), who:Object.keys(npc.NPCS) }));

const LAST_NPC = new Map();            // user id -> when they last spoke to one
app.post('/api/npc', async (req,res)=>{
  const s = auth.fromReq(req);
  if(!s) return bad(res,401,'Sign in to talk — P → Your account.');
  if(!npc.on()) return bad(res,503,'Nobody is answering here — no key on this server.');
  const now = Date.now(), last = LAST_NPC.get(s.id) || 0;
  if(now-last < 1500) return bad(res,429,'One at a time.');
  if(rateLimited('npc:'+s.id, 20, 60000)) return bad(res,429,'Slow down a little — they need a breather.');
  LAST_NPC.set(s.id, now);
  const text = String(req.body.text||'').trim();
  if(!text) return bad(res,400,'say something');
  try{
    const out = await npc.talk({ npc:String(req.body.npc||''), text,
      history:req.body.history, context:req.body.context });
    ok(res, out);
  }catch(e){
    if(e && e.status===404) return bad(res,404,'nobody by that name');
    const busy = e && (e.status===429 || e.status===529);
    if(!busy) console.error('[npc]', e && e.message ? e.message : e);
    bad(res, busy?429:502, busy ? 'They are busy — try again in a moment.' : 'They did not hear you — try again.');
  }
});

/* ===================================================== how it is started
   TWO WAYS IN, and only one of them owns a port.

   `npm start` runs this file, and it does what it has always done: set the
   schema up, then listen, with the WebSocket server riding on the same
   HTTP server so the rooms, the chat and the Mech League work.

   A SERVERLESS HOST REQUIRES IT INSTEAD, to get the Express app and call
   it once per request. There is no port to take and no process to keep,
   so it must not listen — and the sockets cannot work there whatever we
   do, because a function that exists for the length of one request has
   nowhere to hold a connection open. See api/index.js.

   Everything above this line is identical in both. */
const PORT = process.env.PORT || 3000;
/* TAKING THE PORT IS A THING YOU ASK FOR, not a side effect of requiring
   this file. `npm start` asks by being the main module. The local harness
   under tools/ asks by calling start(), because it REQUIRES this file
   rather than running it — a listen that only happened for the main module
   left it loading the whole server and then exiting, silently, with code
   0. A serverless host asks for neither and just takes the app. */
function start(){
  rosters();
  return db.init()
    .catch(e=>console.error('DB init failed — running without accounts:', e.message))
    .finally(()=>server.listen(PORT,()=>
      console.log('Mission: Linux on '+PORT+' (database '+(db.ready?'connected':'OFFLINE')+')')));
}
if(require.main === module) start();
module.exports = { app, server, wss, start };
