/* THE ENGINEER'S TRAIL — the decision engine, and the case it has to hold up.

   Two halves. The first is the evaluator: if it is wrong, every machine in
   the mission lies to a student about what a condition does. The second is
   the case file — a mystery is only solvable if the evidence actually
   points one way, and that is an assertion, not an opinion. */
const test = require('node:test');
const assert = require('node:assert');
const K = require('../public/logic.js');

const { VAR, AND, OR, NOT, CMP } = K;

/* ------------------------------------------------------------ if */
test('a bare if runs its action when true and nothing when false', ()=>{
  const rule={ branches:[{ kind:'if', cond:VAR('p'), action:'go()' }] };
  assert.strictEqual(K.run(rule,{p:true}).action, 'go()');
  assert.strictEqual(K.run(rule,{p:false}).action, null);
  assert.strictEqual(K.run(rule,{p:false}).branch, -1);
});

test('a variable nobody has set reads false rather than throwing', ()=>{
  assert.strictEqual(K.value(VAR('never_wired'), {}), false);
});

/* ---------------------------------------------------------- else */
test('else is the other road, and exactly one road is taken', ()=>{
  const rule=K.machine('robot').rule;
  assert.strictEqual(K.run(rule,{package_delivered:true}).action, 'return_to_station()');
  assert.strictEqual(K.run(rule,{package_delivered:false}).action, 'continue_delivery()');
});

/* ------------------------------------------------------------ or */
test('the gate opens on either answer and stays shut on neither', ()=>{
  const g=K.machine('gate').rule;
  const at=(b,m)=>K.run(g,{badge_valid:b, maintenance_override:m}).action;
  assert.strictEqual(at(true ,false), 'open_gate()');
  assert.strictEqual(at(false,true ), 'open_gate()');
  assert.strictEqual(at(true ,true ), 'open_gate()');
  assert.strictEqual(at(false,false), 'deny_entry()');
});

test('the modification is what makes a badgeless entry possible', ()=>{
  const m=K.machine('gate');
  const st={ badge_valid:false, maintenance_override:true };
  assert.strictEqual(K.run(m.was , st).action, 'deny_entry()');   // before
  assert.strictEqual(K.run(m.rule, st).action, 'open_gate()');    // after
});

/* ----------------------------------------------------------- and */
test('the car stops only when both are true', ()=>{
  const r=K.machine('transit').rule;
  const at=(a,e)=>K.run(r,{authorized_vehicle:a, emergency_signal:e}).action;
  assert.strictEqual(at(true ,true ), 'stop_at_station()');
  assert.strictEqual(at(true ,false), 'continue_route()');
  assert.strictEqual(at(false,true ), 'continue_route()');
  assert.strictEqual(at(false,false), 'continue_route()');
});

test('and and or are not the same machine', ()=>{
  const st={ a:true, b:false };
  assert.strictEqual(K.value(AND(VAR('a'),VAR('b')), st), false);
  assert.strictEqual(K.value(OR (VAR('a'),VAR('b')), st), true);
  assert.strictEqual(K.value(NOT(VAR('b')), st), true);
});

test('comparisons compare', ()=>{
  assert.strictEqual(K.value(CMP('bay','==',17), {bay:17}), true);
  assert.strictEqual(K.value(CMP('bay','==',17), {bay:14}), false);
  assert.strictEqual(K.value(CMP('n','>=',3), {n:3}), true);
});

/* ---------------------------------------------------------- elif */
test('elif below a true branch is never even asked', ()=>{
  const r=K.machine('door').rule;
  const out=K.run(r,{ emergency:true, maintenance_mode:true, employee_badge:true });
  assert.strictEqual(out.action, 'unlock()');
  assert.strictEqual(out.trace[0].tested, true);
  assert.strictEqual(out.trace[1].tested, false);   // not false — unasked
  assert.strictEqual(out.trace[1].value, null);
  assert.strictEqual(out.trace[2].tested, false);
});

test('the ladder falls through to else only when every test failed', ()=>{
  const r=K.machine('door').rule;
  const out=K.run(r,{ emergency:false, maintenance_mode:false, employee_badge:false });
  assert.strictEqual(out.action, 'remain_locked()');
  assert.ok(out.trace.slice(0,3).every(x=>x.tested===true && x.value===false));
});

test('each branch of the door is reachable on its own', ()=>{
  const r=K.machine('door').rule;
  assert.strictEqual(K.run(r,{maintenance_mode:true}).action, 'unlock_and_log()');
  assert.strictEqual(K.run(r,{employee_badge:true}).action, 'request_confirmation()');
});

/* --------------------------------------------- the order is the lesson */
test('moving a line changes the answer without changing a condition', ()=>{
  const m=K.machine('door');
  const st={ emergency:true, maintenance_mode:true };
  const before=K.run(m.rule, st);
  const after =K.run(K.reorder(m.rule, m.swap.from, m.swap.to), st);
  assert.strictEqual(before.action, 'unlock()');          // nothing logged
  assert.strictEqual(after.action , 'unlock_and_log()');  // a name and a time
  assert.notStrictEqual(before.action, after.action);
});

test('whatever ends up on top is the if, and else stays at the bottom', ()=>{
  const r=K.reorder(K.machine('door').rule, 0, 2);
  assert.strictEqual(r.branches[0].kind, 'if');
  assert.ok(r.branches.slice(1,-1).every(b=>b.kind==='elif'));
  assert.strictEqual(r.branches[r.branches.length-1].kind, 'else');
  /* and reordering copies rather than edits: the machine a second student
     opens has to be the machine the first one found */
  assert.strictEqual(K.machine('door').rule.branches[0].cond.v, 'emergency');
});

/* -------------------------------------------------------- the panels */
test('every machine prints as source that reads back the way it runs', ()=>{
  const src=K.source(K.machine('gate').rule);
  assert.deepStrictEqual(src, [
    'if badge_valid or maintenance_override:',
    '    open_gate()',
    'else:',
    '    deny_entry()'
  ]);
});

test('and binds tighter than or, and the brackets say so', ()=>{
  assert.strictEqual(K.text(AND(VAR('a'), OR(VAR('b'),VAR('c')))), 'a and (b or c)');
  assert.strictEqual(K.text(OR(AND(VAR('a'),VAR('b')), VAR('c'))), 'a and b or c');
});

test('the switches a panel draws are the variables the rule reads', ()=>{
  K.MACHINES.forEach(m=>{
    const used=K.ruleNames(m.rule);
    const shown=m.vars.map(v=>v.v);
    assert.deepStrictEqual(used, shown, m.id+' shows the wrong switches');
  });
});

test('a truth table covers every combination once', ()=>{
  const tb=K.table(K.machine('gate').rule);
  assert.strictEqual(tb.rows.length, 4);
  assert.strictEqual(tb.rows.filter(r=>r.action==='open_gate()').length, 3);
  assert.strictEqual(tb.rows.filter(r=>r.action==='deny_entry()').length, 1);
});

/* ------------------------------------------------------- the case file */
test('the trail only names one operator once all four overrides are in', ()=>{
  const r=K.machine('terminal').rule;
  const all={ depot_override:true, gate_override:true,
              transit_override:true, door_override:true };
  assert.strictEqual(K.run(r, all).action, 'one_operator()');
  assert.strictEqual(K.run(r, Object.assign({},all,{door_override:false})).action,
                     'partial_trail()');
  assert.strictEqual(K.run(r, {}).action, 'no_trail()');
});

test('every override in the notebook sets one of the terminal’s readings', ()=>{
  const sets=Object.values(K.CLUES).map(c=>c.sets).filter(Boolean).sort();
  assert.deepStrictEqual(sets,
    ['depot_override','door_override','gate_override','transit_override']);
});

test('the night is four events and they are in the order they happened', ()=>{
  const times=K.TIMELINE.map(e=>e.at);
  assert.deepStrictEqual(times, times.slice().sort());
  assert.deepStrictEqual(K.ORDER, K.TIMELINE.map(e=>e.id));
  /* and every one of them is the time printed on its own machine, or the
     ordering puzzle is a memory test rather than a reading test */
  K.TIMELINE.forEach(e=>{
    const m=K.machine(e.id);
    assert.ok(m && m.log && m.log.indexOf(e.at)===0,
      e.id+' does not print '+e.at+' on its own panel');
  });
});

test('exactly one suspect is right, and the other three are ruled out in words', ()=>{
  const right=K.SUSPECTS.filter(s=>s.right);
  assert.strictEqual(right.length, 1);
  assert.strictEqual(right[0].id, 'tolan');
  K.SUSPECTS.forEach(s=>assert.ok(s.why && s.why.length>20, s.id+' has no reasoning'));
});

test('the same override code is on all four machines and in the roster', ()=>{
  ['robot','gate','transit','door'].forEach(id=>
    assert.ok(K.machine(id).log.indexOf(K.CODE)>=0, id+' does not carry the code'));
  const nell=K.person('nell').lines.find(l=>l.clue==='roster');
  assert.ok(nell.a.indexOf('Marek Tolan')>=0);
  assert.ok(K.CLUES.roster.body.indexOf(K.CREW)>=0);
});

test('no witness can be asked something before there is a reason to ask it', ()=>{
  const known=new Set(Object.keys(K.CLUES));
  K.PEOPLE.forEach(p=>p.lines.forEach(l=>{
    if(l.need) assert.ok(known.has(l.need), p.id+'/'+l.id+' waits on a clue that does not exist');
    if(l.clue) assert.ok(known.has(l.clue), p.id+'/'+l.id+' files a clue that does not exist');
  }));
});

test('no single witness can hand over the answer', ()=>{
  K.PEOPLE.forEach(p=>{
    const all=[p.intro].concat(p.lines.map(l=>l.a)).join(' ');
    const names=all.indexOf('Marek Tolan')>=0;
    const codes=all.indexOf(K.CODE)>=0;
    assert.ok(!(names && codes),
      p.id+' both names the man and carries the code — that is the whole case in one conversation');
  });
});

test('the debrief only claims ideas the mission actually has machines for', ()=>{
  K.LESSONS.forEach(l=>{
    const m=K.machine(l.on);
    assert.ok(m, l.k+' points at a machine that is not there');
    assert.strictEqual(m.concept, l.k);
  });
  /* and every machine is accounted for in the debrief */
  K.MACHINES.forEach(m=>assert.ok(K.LESSONS.some(l=>l.on===m.id), m.id+' teaches nothing'));
});

/* =====================================================================
   THE WIRING — the mission has to be reachable, has to clean up after
   itself, and has to speak both languages. None of these are things you
   would notice by playing the mission; all three are things a class
   notices immediately.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* trail.js touches nothing at load — no THREE, no document, no G — so its
   own tables can be read under Node the way the swarm's stage list is. */
function loadTrail(){
  const ctx={ document:{ querySelector:()=>null }, setTimeout, clearTimeout,
              performance:{ now:()=>0 }, KLOGIC:K, t:s=>s, THREE:{} };
  ctx.window=ctx; ctx.self=ctx;
  vm.createContext(ctx);
  vm.runInContext(read('public/trail.js'), ctx);
  return ctx.TRAIL;
}

test('the district is a floor plan that hangs together', ()=>{
  const T=loadTrail();
  const W=T.PLAN[0].length;
  T.PLAN.forEach((row,i)=>assert.strictEqual(row.length, W, 'row '+i+' is a different width'));
  /* Every walkable tile has to be reachable from the spawn, or a machine
     ends up behind a wall and the mission is unfinishable in a way that
     only shows up when somebody walks there. Barriers are deliberately NOT
     modelled here: a shut gate is a machine's answer, not a wall. */
  const WALK='.SDTVCG^v<>123456789abcdefghijklmnopqrstuvwxyz';
  const at=(x,z)=>(T.PLAN[z]&&T.PLAN[z][x]) || ' ';
  let start=null;
  T.PLAN.forEach((row,z)=>{ const x=row.indexOf('S'); if(x>=0) start=[x,z]; });
  assert.ok(start, 'the plan has no spawn');
  const seen=new Set([start.join(',')]), q=[start];
  while(q.length){
    const [x,z]=q.pop();
    for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const k=(x+dx)+','+(z+dz);
      if(seen.has(k) || WALK.indexOf(at(x+dx,z+dz))<0) continue;
      seen.add(k); q.push([x+dx,z+dz]);
    }
  }
  const stranded=[];
  T.PLAN.forEach((row,z)=>[...row].forEach((c,x)=>{
    if(WALK.indexOf(c)>=0 && !seen.has(x+','+z)) stranded.push(c+' at '+x+','+z); }));
  assert.deepStrictEqual(stranded, [], 'walled off from the spawn');
});

test('every marker in the plan is something the mission puts there', ()=>{
  const T=loadTrail();
  const marks=new Set();
  T.PLAN.forEach(row=>[...row].forEach(c=>{ if(/[1-9a-z]/.test(c)) marks.add(c); }));
  /* consoles, finds and witnesses, plus the two bay posts. If a marker is
     in the plan and nothing reads it, it is a hole in the floor. */
  const used=new Set(['1','2','3','4','5','e','f','p','q','k','a','b','c','d']);
  [...marks].forEach(c=>assert.ok(used.has(c), 'marker "'+c+'" is in the plan and unread'));
  [...used].forEach(c=>assert.ok(marks.has(c), 'nothing in the plan marks "'+c+'"'));
});

test('every action a rule can reach does something to the district', ()=>{
  const T=loadTrail();
  K.MACHINES.forEach(m=>m.rule.branches.forEach(b=>{
    assert.ok(T.ACTIONS[b.action], m.id+' can land on '+b.action+' and nothing happens');
    assert.ok(T.ACTIONS[b.action].line, b.action+' says nothing about what it did');
  }));
});

test('every stage can be finished, and the last one ends the mission', ()=>{
  const T=loadTrail();
  /* A stage whose done() can never be satisfied is a mission that stops
     dead. Walk the whole thing with a state that has everything in it. */
  const all={ clues:{}, flags:{} };
  Object.keys(K.CLUES).forEach(k=>{ all.clues[k]=true; });
  ['crate_home','gate_open','car_berthed','door_open','crossref','timeline','named']
    .forEach(f=>{ all.flags[f]=true; });
  T.STAGES.forEach(s=>{
    assert.ok(s.obj && s.hint, s.id+' has no objective or no hint');
    assert.ok(s.done(all), s.id+' can never be finished');
  });
  /* and nothing is finished on a blank save, or the mission opens solved */
  const none={ clues:{}, flags:{} };
  assert.ok(!T.STAGES[0].done(none), 'the first stage is already done on a fresh save');
});

test('the trail is a station, a card, dispatched, and on the page', ()=>{
  assert.match(read('public/planet.js'), /id:'trail'/, 'no station row in PLANET.STATIONS');
  assert.match(read('public/menu.js'),   /id:'trail'/, 'no card on the mission grid');
  assert.match(read('public/game.js'),   /id==='trail'/, 'startMissionRoom does not dispatch it');
  const page=read('public/index.html');
  assert.match(page, /src="logic\.js/, 'the engine is not loaded by the page');
  assert.match(page, /src="trail\.js/, 'the mission is not loaded by the page');
  /* the engine has to be defined before the mission that reads it */
  assert.ok(page.indexOf('logic.js') < page.indexOf('trail.js'),
    'trail.js is loaded before the engine it is built on');
});

test('a student who has finished nothing can still walk into the trail', ()=>{
  const game=read('public/game.js');
  const order=game.slice(game.indexOf('const ORDER='));
  const ids=[...order.slice(0, order.indexOf(';')).matchAll(/'([a-z0-9]+)'/g)].map(m=>m[1]);
  assert.ok(ids.length, 'could not read the unlock order');
  assert.ok(!ids.includes('trail'),
    'trail is in ORDER, so a mystery about reading code is locked behind four missions about writing it');
});

test('the trail cleans up after itself when you leave', ()=>{
  for(const f of ['public/game.js','public/menu.js','public/planet.js'])
    assert.match(read(f), /TRAIL\.stop\(\)/, f+' never stops the mission');
  /* and hands back the two HUD headings it borrowed */
  const t=read('public/trail.js');
  assert.match(t, /objTitle[\s\S]{0,80}MISSION/, 'the objective panel keeps the mission\u2019s title');
  assert.match(t, /mapTitle[\s\S]{0,90}DESKTOP MAP/, 'the map keeps the mission\u2019s title');
});

test('Mission Control has somewhere new to stand it', ()=>{
  const planet=read('public/planet.js');
  const table=planet.slice(planet.indexOf('const STATIONS=['));
  const stations=(table.slice(0, table.indexOf('];')).match(/\{ id:'/g)||[]).length;
  const spots=planet.slice(planet.indexOf('const spots=['));
  const n=(spots.slice(0, spots.indexOf('];')).match(/\{ x:/g)||[]).length;
  assert.ok(n>=stations, stations+' stations and only '+n+' plinths');
  /* and no two consoles in the same place, which is what "one short" looks
     like from the floor of the hall */
  const xs=[...spots.slice(0, spots.indexOf('];')).matchAll(/\{ x:\s*(-?[\w.\-+ ]+?),\s*z:\s*(-?[\w.\-+ ]+?),/g)]
    .map(m=>m[1].trim()+'|'+m[2].trim());
  assert.strictEqual(new Set(xs).size, xs.length, 'two stations share a plinth');
});

test('everything the trail says, it can say in Spanish', ()=>{
  /* t() falls back to its key, so an untranslated string does not break —
     it just quietly turns half of this lab's game back into English. */
  const T=loadTrail();
  const said=new Set(), add=s=>{ if(s && String(s).trim()) said.add(String(s)); };
  const src=read('public/trail.js');
  for(const m of src.matchAll(/\bsay\(\s*'((?:[^'\\]|\\.)*)'/g))
    add(JSON.parse('"'+m[1].replace(/\\'/g,"'").replace(/"/g,'\\"')+'"'));
  K.MACHINES.forEach(m=>{ add(m.name); add(m.sub); add(m.lead); add(m.falls); add(m.log);
    (m.vars||[]).forEach(v=>add(v.hint));
    m.rule.branches.forEach(b=>add(b.note));
    if(m.swap){ add(m.swap.ask); add(m.swap.found); } });
  K.PEOPLE.forEach(p=>{ add(p.role); add(p.intro);
    p.lines.forEach(l=>{ add(l.q); add(l.a); }); });
  Object.values(K.CLUES).forEach(c=>{ add(c.head); add(c.body); });
  K.TIMELINE.forEach(e=>add(e.what));
  K.SUSPECTS.forEach(s=>{ add(s.role); add(s.why); });
  K.LESSONS.forEach(l=>{ add(l.head); add(l.body); });
  T.ZONES.forEach(z=>add(z.name));
  T.FINDS.forEach(f=>{ add(f.name); add(f.body); add(f.locked); });
  T.STAGES.forEach(s=>{ add(s.obj); add(s.hint); add(s.where); });
  /* the walked opening: COACH runs every step's text through t() too, and a
     walkthrough that reverts to English is the worst thing to lose */
  for(const m of src.matchAll(/say:'((?:[^'\\]|\\.)*)'/g))            // COACH step
    add(JSON.parse('"'+m[1].replace(/\\'/g,"'").replace(/"/g,'\\"')+'"'));
  for(const m of src.matchAll(/finish:'((?:[^'\\]|\\.)*)'/g))
    add(JSON.parse('"'+m[1].replace(/\\'/g,"'").replace(/"/g,'\\"')+'"'));
  Object.values(T.ACTIONS).forEach(a=>add(a.line));
  /* the status chip is a word on the screen as much as anything else is */
  Object.values(T.ACTIONS).forEach(a=>add(a.status));
  add('IDLE');

  const g={}; g.window=g; vm.createContext(g);
  vm.runInContext(read('public/strings.js'), g);
  const ES=g.window.ES;
  const missing=[...said].filter(s=>ES[s]===undefined);
  assert.deepStrictEqual(missing, [],
    missing.length+' string(s) reach the screen with no Spanish');
});

/* =====================================================================
   ARRIVING IN A ROOM.

   Two things a mission inherits from wherever you came from, both of
   which are invisible until they are wrong, and both of which were:

   THE PLANET. PLANET.use() takes you to a mission by way of leave() —
   it puts the body back on its feet, hands the flat rooms their camera
   and their daylight back, and writes down where you were standing.
   Nothing else does. Pause, Quit, pick a mission off the grid, and the
   planet is still ON underneath it: still ticking, still drawing its own
   minimap over the mission's, and still taking WASD, because step()
   hands movement to PLANET.walk() for as long as PLANET.active.

   THE POSTURE. It is the planet saying it owns the whole situation of
   the body, and it outranks every walk, idle and jump while it is set.
   Leave a world in mid-flight by that same route and you arrive lying
   flat on the floor, running the flight clip on a carpet.

   These are asserted against the source because game.js cannot be
   loaded under Node — it wants THREE and a document at load — which is
   how the rest of this file checks it too.
   ===================================================================== */
test('every door into a room gets you off the planet and back on your feet', ()=>{
  const game=read('public/game.js');
  /* the body of each function, up to the next top-level `function` */
  const bodyOf = name => {
    const at=game.indexOf('function '+name+'(');
    assert.ok(at>=0, name+'() is gone');
    const rest=game.slice(at+1);
    const end=rest.indexOf('\nfunction ');
    return rest.slice(0, end<0 ? rest.length : end);
  };
  for(const door of ['startMissionRoom','buildRoom']){
    const body=bodyOf(door);
    assert.match(body, /PLANET\.active\)\s*PLANET\.stop\(\)/,
      door+'() leaves the planet running underneath the room it builds');
    assert.match(body, /AVATAR\.posture\(null\)/,
      door+'() leaves the body in whatever posture the planet set');
  }
});

test('the posture is cleared where a room is built, not where a body is attached', ()=>{
  /* attach() is also what the quick change calls, and somebody who presses
     B at four hundred metres is still flying. Clearing it there would drop
     them into a run on nothing — so the reset belongs to the room, and
     AVATAR must not have opinions about it. */
  const avatar=read('public/avatar.js');
  const at=avatar.indexOf('function attach(');
  assert.ok(at>=0, 'AVATAR.attach() is gone');
  const body=avatar.slice(at, avatar.indexOf('\n  function ', at+10));
  assert.ok(!/posture\s*=/.test(body) && !/setPosture\(/.test(body),
    'attach() now resets the posture — changing character in mid-air will drop the flight clip');
});

test('a flat room poses the whole body, not just its heading', ()=>{
  /* THE ONE THAT ACTUALLY PUT YOU ON THE FLOOR.

     `rotation` is an Euler, and writing one of its three numbers leaves the
     other two exactly as they were. In a flat room a body only ever turns
     about y, so `body.rotation.y = …` looks complete — and is, until you
     arrive from a planet. There, orient() builds the body's quaternion from
     the surface normal, three.js decomposes it back into an Euler with real
     x and z in it (seventy degrees of x at Senio's front door), and attach()
     carries that pose into the next room so a character swapped in mid-air
     keeps it. The heading then updates about a y the body is no longer
     standing on, and the result idles on its back for ever.

     So: all three, every frame. Asserted against the source because
     avatar.js wants THREE and a live G at load, which is how the rest of
     this file checks the browser files too. */
  const avatar=read('public/avatar.js');
  const at=avatar.indexOf('function update(dt, moving, running, onGround)');
  assert.ok(at>=0, 'AVATAR.update() is gone');
  const body=avatar.slice(at, avatar.indexOf('\n  function ', at+10));

  assert.ok(!/body\.rotation\.[xyz]\s*=/.test(body),
    'update() writes a single rotation component again — the other two are ' +
    'inherited from whatever posed the body last, and on a planet that is a tilt');
  assert.match(body, /body\.rotation\.set\(\s*0\s*,[^)]*,\s*0\s*\)/,
    'update() no longer zeroes x and z, so a body walking in off a planet keeps its tilt');

  /* and the planet's own path must still build a full basis, or standing on
     a ball stops working — which is the obvious wrong way to "fix" this */
  const oAt=avatar.indexOf('function orient(');
  const orient=avatar.slice(oAt, avatar.indexOf('\n  function ', oAt+10));
  assert.match(orient, /setFromRotationMatrix/,
    'orient() no longer poses from a basis — a body on a sphere stands on its surface normal');
});
