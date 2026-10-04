/* CALLS — the server's half of a phone call: who rings whom, who picked
   up, and passing the handshake between them. The sound never comes
   through here, so what is checked is the bookkeeping: a call is two
   people, it follows the same mute the texts do, it ends when either tab
   goes, and the teacher can see that it happened. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createCalls } = require('../server/calls');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function rig(){
  const people = { ana:{ id:1, username:'ana', display:'Ana' }, bo:{ id:2, username:'bo', display:'Bo' },
                   cy:{ id:3, username:'cy', display:'Cy' }, dee:{ id:4, username:'dee', display:'Dee' } };
  const socks = new Map();       // ws -> person record
  const sock = (who, extra) => { const ws = { readyState:1, got:[], send(r){ this.got.push(JSON.parse(r)); } };
    socks.set(ws, Object.assign({ mutedUntil:0 }, people[who], extra)); return ws; };
  let timers = [];
  const calls = createCalls({
    sockets: id => [...socks].filter(([,p])=>p.id===id).map(([w])=>w),
    sendTo: (id, obj) => { for(const [w,p] of socks) if(p.id===id) w.send(JSON.stringify(obj)); },
    setTimer: fn => { timers.push(fn); return fn; },
    clearTimer: fn => { timers = timers.filter(x=>x!==fn); }
  });
  const lookup = async n => people[n] || null;
  const say = async (ws, m) => calls.handle(ws, socks.get(ws), m, lookup);
  const last = ws => ws.got[ws.got.length-1];
  return { calls, sock, say, last, socks, fire:()=>{ const t=timers; timers=[]; t.forEach(f=>f()); } };
}

test('a call rings every tab, the one that answers keeps it, the rest stop', async ()=>{
  const r = rig();
  const a = r.sock('ana'), b1 = r.sock('bo'), b2 = r.sock('bo');
  await r.say(a, { op:'ring', to:'bo' });
  assert.strictEqual(r.last(a).op, 'ringing');
  const id = r.last(a).id;
  assert.strictEqual(r.last(b1).op, 'ring'); assert.strictEqual(r.last(b2).op, 'ring');
  assert.strictEqual(r.last(b1).with.username, 'ana');
  await r.say(b2, { op:'answer', id });
  assert.strictEqual(r.last(a).op, 'answered');
  assert.deepStrictEqual([r.last(b1).op, r.last(b1).how], ['end', 'elsewhere']);
  // the handshake goes only to the tab that answered, and back
  await r.say(a, { op:'sig', id, d:{ sdp:{ type:'offer', sdp:'v=0' } } });
  assert.strictEqual(r.last(b2).op, 'sig');
  assert.notStrictEqual(r.last(b1).op, 'sig');
  await r.say(b2, { op:'sig', id, d:{ cand:{ candidate:'x' } } });
  assert.deepStrictEqual(r.last(a).d, { cand:{ candidate:'x' } });
  // the other tab cannot speak on a call it did not answer
  const before = a.got.length;
  await r.say(b1, { op:'sig', id, d:{ x:1 } });
  assert.strictEqual(a.got.length, before);
  await r.say(a, { op:'hang', id });
  assert.deepStrictEqual([r.last(b2).how, r.last(b2).by], ['ended', 'them']);
  assert.strictEqual(r.calls.active(), 0);
});

test('nobody online, yourself, a busy line and a muted caller are all refused', async ()=>{
  const r = rig();
  const a = r.sock('ana'), b = r.sock('bo'), c = r.sock('cy'), m = r.sock('dee', { mutedUntil:Date.now()+60000 });
  await r.say(a, { op:'ring', to:'nobody' });   assert.match(r.last(a).reason, /Nobody has that username/);
  await r.say(a, { op:'ring', to:'ana' });      assert.match(r.last(a).reason, /That is you/);
  await r.say(m, { op:'ring', to:'ana' });      assert.match(r.last(m).reason, /muted/);
  r.socks.delete(c);
  await r.say(a, { op:'ring', to:'cy' });       assert.match(r.last(a).reason, /not online/);
  r.socks.set(c, { id:3, username:'cy', display:'Cy', mutedUntil:0 });
  await r.say(a, { op:'ring', to:'bo' });
  await r.say(c, { op:'ring', to:'bo' });       assert.match(r.last(c).reason, /on another call/);
  void b;
});

test('an unanswered call is missed, a closed tab ends a live one, a mute hangs up', async ()=>{
  const r = rig();
  const a = r.sock('ana'), b = r.sock('bo');
  await r.say(a, { op:'ring', to:'bo' });
  r.fire();
  assert.deepStrictEqual([r.last(a).op, r.last(a).how], ['end', 'missed']);
  assert.strictEqual(r.last(b).how, 'missed');

  await r.say(a, { op:'ring', to:'bo' });
  await r.say(b, { op:'answer', id:r.last(a).id });
  r.calls.gone(b, r.socks.get(b));
  assert.strictEqual(r.last(a).how, 'dropped');

  await r.say(a, { op:'ring', to:'bo' });
  await r.say(b, { op:'answer', id:r.last(a).id });
  r.calls.muted(1);
  assert.strictEqual(r.last(b).how, 'muted');

  const log = r.calls.log();
  assert.deepStrictEqual(log.map(x=>x.how), ['muted', 'dropped', 'missed']);
  assert.ok(log.every(x=>x.from==='ana' && x.to==='bo'));
  assert.ok(!JSON.stringify(log).includes('sdp'), 'the teacher log holds who and when, never the handshake');
});

test('the server wires calls to the socket, the mute and the teacher', ()=>{
  const srv = read('server/index.js');
  assert.match(srv, /if\(m\.t==='call'\)/, 'the socket does not pass calls on');
  assert.match(srv, /rateLimited\('call:'/, 'calling is not rate limited');
  assert.match(srv, /calls\.gone\(ws, p\)/, 'a closed tab does not end its call');
  assert.match(srv, /calls\.muted\(/, 'a teacher mute does not hang up a call');
  assert.match(srv, /app\.get\('\/api\/teacher\/calls', async \(req,res\)=>\{\s*const t = await requireTeacher/, 'the call log is not teacher-only');
  assert.match(srv, /ice:iceServers\(\)/, 'the browser is not told how to reach the other side');
  assert.match(read('public/teacher.js'), /\/teacher\/calls/, 'the teacher panel does not show calls');
  const html = read('public/index.html');
  assert.ok(html.indexOf('call.js') > html.indexOf('phone.js'), 'call.js must load after phone.js');
});

test('Opus is asked to be quick', ()=>{
  global.window = {}; global.document = { readyState:'complete', querySelector:()=>null };
  global.t = s => s;
  require('../public/call.js');
  const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=0\r\n';
  const out = window.CALL._quick(sdp);
  assert.match(out, /a=fmtp:111 [^\r\n]*useinbandfec=1/);
  assert.match(out, /usedtx=0/);
  assert.match(out, /a=ptime:10/);
  assert.ok(!/useinbandfec=0/.test(out), 'the old setting was left in beside the new one');
});
