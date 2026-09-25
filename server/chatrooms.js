/* =====================================================================
   CHAT ROOMS — places players own inside KORO.

   Not a channel with a picture behind it: a room is a small world of its
   own — a floor, walls, light, a sky, furniture and things that do things
   — that its owner builds and other people walk into as themselves. The
   game (koro-godot/scripts/chatroom.gd) stands it up as one more KORO
   world, and the rooms' live half is the same socket rooms the planets
   use: a Chat Room is the server id `cr:<id>`.

   WHAT A ROOM MAY CONTAIN IS DECIDED HERE, NEVER BY THE CLIENT. The one
   description of the parts (koro-godot/data/chatrooms.json — the same file
   the game builds from) is read once; everything a client sends is washed
   through it: names cut short, colours that are colours, object types that
   exist, positions inside the room, scales within reason, text of a
   sensible length, and robot programs made only of the blocks listed.
   Ownership and permission are checked against the database on every
   request, from the session — never from anything the client says.

   PERSISTENT AND LIVE ARE KEPT APART. Postgres holds what the room IS
   (its name, owner, access, environment and objects). Who is standing in
   it, where, and which switch was flicked a moment ago is live state in
   server/index.js, in memory, gone when the room empties.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

let CATALOG = null;
try {
  CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'koro-godot', 'data', 'chatrooms.json'), 'utf8'));
} catch (e) {
  console.warn('chat rooms: no catalog (koro-godot/data/chatrooms.json) — rooms are off');
}
const on = () => !!CATALOG;

const ACCESS = ['private', 'invited', 'public'];
const MAX_OWNED = 6;
const CAST = ['nia', 'sable', 'kofi', 'theo', 'zuri'];
const HEX = /^#[0-9a-f]{6}$/i;

const clampNum = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const cleanText = (s, max) => String(s == null ? '' : s)
  .replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

function cleanName(s) {
  return cleanText(s, CATALOG.limits.name);
}

/* ------------------------------------------------------ environment */
function cleanEnv(env, base) {
  const E = CATALOG.env;
  const b = base || CATALOG.templates.empty.env;
  env = env && typeof env === 'object' ? env : {};
  const pick = (k, list) => list.includes(env[k]) ? env[k] : b[k];
  const col = k => HEX.test(String(env[k] || '')) ? String(env[k]).toLowerCase() : b[k];
  return {
    floor: pick('floor', E.floor), floorColor: col('floorColor'),
    walls: pick('walls', E.walls), wallColor: col('wallColor'),
    ceiling: typeof env.ceiling === 'boolean' ? env.ceiling : !!b.ceiling, ceilingColor: col('ceilingColor'),
    light: pick('light', E.light), lightColor: col('lightColor'),
    brightness: clampNum(env.brightness, 0.2, 2.0, b.brightness),
    sky: pick('sky', E.sky)
  };
}

/* ---------------------------------------------------------- objects */
function cleanProgram(prog) {
  const B = CATALOG.blocks;
  const out = [];
  for (const step of (Array.isArray(prog) ? prog : []).slice(0, 40)) {
    if (!Array.isArray(step) || !B[step[0]] || step[0] === '_') continue;
    const kinds = B[step[0]];
    const clean = [step[0]];
    kinds.forEach((k, i) => {
      const v = step[i + 1];
      if (k === 'n') clean.push(clampNum(v, -1000, 1000, 0));
      else if (k === 'axis') clean.push(['x', 'y', 'z'].includes(v) ? v : 'z');
      else clean.push(cleanText(v, 40));
    });
    out.push(clean);
  }
  return out;
}

function cleanProps(type, props) {
  const def = CATALOG.objects[type].props || {};
  props = props && typeof props === 'object' ? props : {};
  const out = {};
  for (const k of Object.keys(def)) {
    const v = props[k] === undefined ? def[k] : props[k];
    if (k === 'color') out[k] = HEX.test(String(v)) ? String(v).toLowerCase() : def[k];
    else if (k === 'text') out[k] = cleanText(v, CATALOG.limits.text);
    else if (k === 'art') out[k] = Math.round(clampNum(v, 1, 3, 1));
    else if (k === 'who') out[k] = CAST.includes(v) ? v : def[k];
    else if (k === 'to') out[k] = /^\d{0,10}$/.test(String(v)) ? String(v) : '';
    else if (k === 'program') out[k] = cleanProgram(v);
  }
  return out;
}

let seq = 0;
const newId = () => (Date.now().toString(36).slice(-5) + (seq++ % 1296).toString(36)).slice(0, 12);

function cleanObjects(list) {
  const S = CATALOG.size;
  const out = [];
  const seen = new Set();
  for (const o of (Array.isArray(list) ? list : [])) {
    if (out.length >= CATALOG.limits.objects) break;
    if (!o || typeof o !== 'object' || !CATALOG.objects[o.type]) continue;
    let id = /^[a-z0-9]{1,12}$/.test(String(o.id || '')) ? String(o.id) : newId();
    while (seen.has(id)) id = newId();
    seen.add(id);
    const p = Array.isArray(o.p) ? o.p : [0, 0, 0];
    out.push({
      id, type: o.type,
      p: [clampNum(p[0], -S.w / 2 + 0.2, S.w / 2 - 0.2, 0),
          clampNum(p[1], 0, S.h - 0.2, 0),
          clampNum(p[2], -S.d / 2 + 0.2, S.d / 2 - 0.2, 0)],
      r: ((clampNum(o.r, -3600, 3600, 0) % 360) + 360) % 360,
      s: clampNum(o.s, 0.2, 4, 1),
      props: cleanProps(o.type, o.props)
    });
  }
  return out;
}

function fromTemplate(key) {
  const t = CATALOG.templates[key] || CATALOG.templates.empty;
  return { template: CATALOG.templates[key] ? key : 'empty',
           env: cleanEnv(t.env, t.env), objects: cleanObjects(t.objects) };
}

/* --------------------------------------------------------- the store
   Every statement is written once, here, so server/memdb.js (the stand-in
   the dev server and the Mac app run on) has exactly these to answer. */
/* a card carries the room's environment so a list can draw each room in its own colours */
const CARD = 'r.id,r.name,r.access,r.owner_id,r.template,r.env,u.display AS owner_display';

function makeStore(db) {
  const one = async (sql, p) => (await db.q(sql, p)).rows[0] || null;
  const all = async (sql, p) => (await db.q(sql, p)).rows;
  const room = id => one(
    'SELECT r.id,r.owner_id,r.name,r.access,r.template,r.env,r.objects,r.updated_at,u.display AS owner_display,u.username AS owner_username ' +
    'FROM chat_rooms r JOIN users u ON u.id=r.owner_id WHERE r.id=$1', [id]);
  const isMember = async (roomId, userId) =>
    !!(await one('SELECT 1 AS yes FROM chat_room_members WHERE room_id=$1 AND user_id=$2', [roomId, userId]));
  return {
    room, isMember,
    /* PRIVATE is the owner alone; INVITED is the owner and the people on the
       list; PUBLIC is anybody signed in. The list is kept whatever the
       access, so a room made private and opened again lets the same
       people back in. */
    async canEnter(r, userId) {
      if (!r) return false;
      if (r.owner_id === userId || r.access === 'public') return true;
      return r.access === 'invited' && isMember(r.id, userId);
    },
    countOwned: async userId => Number((await one('SELECT count(*)::int AS n FROM chat_rooms WHERE owner_id=$1', [userId])).n || 0),
    create: async (ownerId, name, access, t) => one(
      'INSERT INTO chat_rooms (owner_id,name,access,template,env,objects) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [ownerId, name, access, t.template, JSON.stringify(t.env), JSON.stringify(t.objects)]),
    mine: userId => all('SELECT ' + CARD + ' FROM chat_rooms r JOIN users u ON u.id=r.owner_id WHERE r.owner_id=$1 ORDER BY r.updated_at DESC LIMIT 30', [userId]),
    invited: userId => all('SELECT ' + CARD + ' FROM chat_room_members m JOIN chat_rooms r ON r.id=m.room_id JOIN users u ON u.id=r.owner_id WHERE m.user_id=$1 ORDER BY m.added_at DESC LIMIT 30', [userId]),
    recent: userId => all('SELECT ' + CARD + ' FROM chat_room_visits v JOIN chat_rooms r ON r.id=v.room_id JOIN users u ON u.id=r.owner_id WHERE v.user_id=$1 ORDER BY v.at DESC LIMIT 12', [userId]),
    search: (q, userId) => all('SELECT ' + CARD + " FROM chat_rooms r JOIN users u ON u.id=r.owner_id WHERE (r.access<>'private' OR r.owner_id=$2) AND lower(r.name) LIKE $1 ORDER BY r.updated_at DESC LIMIT 20",
      ['%' + String(q).toLowerCase().replace(/[%_\\]/g, '') + '%', userId]),
    members: roomId => all('SELECT u.id,u.username,u.display FROM chat_room_members m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY u.display', [roomId]),
    addMember: (roomId, userId) => db.q('INSERT INTO chat_room_members (room_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roomId, userId]),
    removeMember: (roomId, userId) => db.q('DELETE FROM chat_room_members WHERE room_id=$1 AND user_id=$2', [roomId, userId]),
    visit: (userId, roomId) => db.q('INSERT INTO chat_room_visits (user_id,room_id,at) VALUES ($1,$2,now()) ON CONFLICT (user_id,room_id) DO UPDATE SET at=now()', [userId, roomId]),
    save: (roomId, env, objects) => db.q('UPDATE chat_rooms SET env=$2,objects=$3,updated_at=now() WHERE id=$1', [roomId, JSON.stringify(env), JSON.stringify(objects)]),
    rename: (roomId, name) => db.q('UPDATE chat_rooms SET name=$2,updated_at=now() WHERE id=$1', [roomId, name]),
    setAccess: (roomId, access) => db.q('UPDATE chat_rooms SET access=$2,updated_at=now() WHERE id=$1', [roomId, access]),
    remove: roomId => db.q('DELETE FROM chat_rooms WHERE id=$1', [roomId])
  };
}

/* A room as the game receives it: what it is, and what you may do in it. */
function view(r, userId) {
  const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
  return { id: r.id, name: r.name, access: r.access, template: r.template,
           owner: { id: r.owner_id, display: r.owner_display, username: r.owner_username },
           mine: r.owner_id === userId,
           env: parse(r.env), objects: parse(r.objects) };
}

module.exports = { on, get CATALOG() { return CATALOG; }, ACCESS, MAX_OWNED,
  cleanName, cleanEnv, cleanObjects, cleanProgram, fromTemplate, makeStore, view };
