/* =====================================================================
   MECHACODE — what a mecha's parts are told to do, and why they did it.

   THIS IS NOT THE ARENA LANGUAGE. In the Gym a program is a tape: the
   whole fight is a list of moves played out. Here the student is holding
   the controls — walking, turning, backing off — and the code is not
   driving the robot, it is REACTING for it. So a program is not a
   sequence, it is a set of standing orders:

       WHEN enemy detected
         IF enemy distance < 5
           PUNCH
         ELSE
           BLOCK

   Sixty times a second, every part with a program is asked one question:
   "given what you can see right now, what do you do?" It answers with at
   most one action, because an arm can only be doing one thing at a time.
   That constraint is the whole lesson — an order that never gets reached
   is an order that never runs, and the trace says exactly where the
   reading went the other way.

   ONE PROGRAM PER PART. The left arm's PUNCH is the left arm punching;
   there is no block that says which limb, because the limb is which
   editor you are typing in. Destroy an arm and its orders stop being
   carried out, and the student's answer to that is different code, not
   a different button.

   Pure, like program.js and for the same reason: the server decides
   these matches and has no screen. Same tree in, same action out, on
   both machines.
   ===================================================================== */
(function(root){

  /* ---------------------------------------------------------- events
     What can wake a rule up. `always` is the FOREVER of this language:
     it is asked on every single tick, which is what a standing order is.
     The rest fire on something changing, so a student can write "when I
     am hit" without writing the test for it. */
  const EVENTS=[
    { id:'always',          label:'ALWAYS',            help:'Checked every moment of the fight.' },
    { id:'enemy_detected',  label:'WHEN ENEMY NEAR',   help:'Your sensor can see the other mecha.' },
    { id:'incoming_attack', label:'WHEN ATTACKED',     help:'Their arm is winding up at you. This is your one chance to block.' },
    { id:'hit',             label:'WHEN HIT',          help:'Something just landed on you.' },
    { id:'health_low',      label:'WHEN HEALTH LOW',   help:'Your core is under a third.' },
    { id:'energy_low',      label:'WHEN ENERGY LOW',   help:'You are nearly out of energy.' },
    { id:'start',           label:'WHEN ROUND STARTS', help:'Once, on the bell.' }
  ];
  const EVENT_IDS=EVENTS.map(e=>e.id);

  /* --------------------------------------------------------- sensors
     Numbers a rule can ask for. Every one of them is a number rather
     than a yes/no on purpose: "enemy distance < 5" teaches a comparison,
     "enemy is close" teaches a word somebody else chose. */
  const SENSORS=[
    { id:'enemy_distance', label:'ENEMY DISTANCE', max:40,  help:'How far away they are, in metres.' },
    { id:'enemy_health',   label:'ENEMY CORE',     max:100, help:'How much core they have left, out of 100.' },
    { id:'my_health',      label:'MY CORE',        max:100, help:'How much core YOU have left.' },
    { id:'my_energy',      label:'MY ENERGY',      max:100, help:'Energy left. Every action spends some.' },
    { id:'my_heat',        label:'MY HEAT',        max:100, help:'Heat. At 100 the arms lock up.' },
    { id:'enemy_facing',   label:'ENEMY FACING ME',max:1,   help:'1 when they are looking at you, 0 when their back is turned.' }
  ];
  const SENSOR_IDS=SENSORS.map(s=>s.id);
  const OPS=['<','>','='];

  /* --------------------------------------------------------- actions
     Grouped by the part that can do them, because a program belongs to a
     part. An arm cannot dodge and legs cannot punch, and rather than
     explain that in a help bubble the palette simply never offers it. */
  const ACTIONS={
    punch :{ part:'arm',  label:'PUNCH',       energy:3,  heat:2,  help:'Quick. Short reach. Cheap enough to throw often.' },
    heavy :{ part:'arm',  label:'HEAVY PUNCH', energy:7,  heat:7,  help:'Slow, and it roots you while it winds up — but it hurts.' },
    block :{ part:'arm',  label:'BLOCK',       energy:2,  heat:1,  help:'Hold the arm up. Soaks what lands on that side.' },
    dodge :{ part:'legs', label:'DODGE',       energy:3,  heat:1,  help:'Throw yourself sideways, out of the way of what is coming.' },
    brace :{ part:'legs', label:'BRACE',       energy:2,  heat:0,  help:'Plant your feet. You are pushed around less.' }
  };
  const partActions = part => Object.keys(ACTIONS).filter(k=>ACTIONS[k].part===part);

  /* Which parts carry a program at all. Legs are in; the core and the
     sensor are damageable but they do not take orders — what they do is
     stop working, which is the interesting thing about them. */
  const PARTS=[
    { id:'left_arm',  label:'LEFT ARM',  kind:'arm',  hp:100 },
    { id:'right_arm', label:'RIGHT ARM', kind:'arm',  hp:100 },
    { id:'legs',      label:'LEGS',      kind:'legs', hp:100 },
    { id:'sensor',    label:'SENSOR',    kind:'none', hp:100 },
    { id:'core',      label:'CORE',      kind:'none', hp:200 }
  ];
  const partById = id => PARTS.find(p=>p.id===id) || null;

  /* ------------------------------------------------------- the shape
     A program is a list of WHEN rules. Inside a rule: IF blocks, which
     hold a body and an else, and actions, which end the decision. */
  function countBlocks(list){
    let n=0;
    for(const b of (list||[])){ n++; n+=countBlocks(b.body); n+=countBlocks(b.else); }
    return n;
  }

  /* Checked before a program is allowed into a match, by whoever is
     refereeing it. Every message is a sentence a student can act on. */
  function validate(program, rules){
    rules=rules||{};
    const errs=[];
    const allow = new Set(rules.allow || Object.keys(ACTIONS));
    const limit = rules.limit || 24;
    const n = countBlocks(program);
    if(!Array.isArray(program)) return { ok:false, errors:[{ msg:'That is not a program.' }], blocks:0 };
    if(n>limit) errs.push({ code:'over-budget',
      msg:'That is '+n+' blocks and this part holds '+limit+'.' });

    (function scan(list, inRule){
      for(const b of (list||[])){
        if(b.type==='when'){
          if(!inRule){
            if(!EVENT_IDS.includes(b.ev))
              errs.push({ code:'bad-event', blockId:b.id, msg:'"'+b.ev+'" is not something that happens.' });
          } else {
            errs.push({ code:'nested-when', blockId:b.id,
              msg:'A WHEN cannot go inside another WHEN.' });
          }
          scan(b.body, true);
        } else if(!inRule){
          errs.push({ code:'loose-block', blockId:b.id,
            msg:'Every block has to sit under a WHEN, or nothing ever asks it.' });
        } else if(b.type==='if'){
          if(!SENSOR_IDS.includes(b.sensor))
            errs.push({ code:'bad-sensor', blockId:b.id, msg:'"'+b.sensor+'" is not a sensor this mecha has.' });
          if(!OPS.includes(b.op))
            errs.push({ code:'bad-op', blockId:b.id, msg:'"'+b.op+'" is not a comparison.' });
          if(!(typeof b.n==='number' && isFinite(b.n)))
            errs.push({ code:'bad-number', blockId:b.id, msg:'That comparison has no number in it.' });
          scan(b.body, true); scan(b.else, true);
        } else if(ACTIONS[b.type]){
          if(!allow.has(b.type))
            errs.push({ code:'not-allowed', blockId:b.id,
              msg:'"'+ACTIONS[b.type].label+'" is not something this part can do.' });
        } else {
          errs.push({ code:'unknown', blockId:b.id, msg:'"'+b.type+'" is not a block.' });
        }
      }
    })(program, false);

    return { ok:!errs.length, errors:errs, blocks:n };
  }

  /* ------------------------------------------------------- the reading
     Given what the part can see this instant, what does it do? At most
     one action, and a trace of every step that led to it — because "my
     robot did nothing" is the question this whole file exists to answer.

     Rules are read top to bottom and the FIRST action wins, which is
     what makes the order of a program matter. */
  function decide(program, s){
    const trace=[];
    for(const rule of (program||[])){
      if(!rule || rule.type!=='when') continue;
      if(!fired(rule.ev, s)) continue;
      trace.push({ kind:'event', ev:rule.ev, blockId:rule.id });
      const act=run(rule.body, s, trace);
      if(act) return { action:act, trace };
    }
    return { action:null, trace };
  }
  function run(list, s, trace){
    for(const b of (list||[])){
      if(!b) continue;
      if(b.type==='if'){
        const v=read(b.sensor, s);
        const yes=compare(v, b.op, b.n);
        trace.push({ kind:'test', blockId:b.id, sensor:b.sensor, value:v, op:b.op, n:b.n, yes });
        const act=run(yes ? b.body : b.else, s, trace);
        if(act) return act;
      } else if(ACTIONS[b.type]){
        trace.push({ kind:'action', blockId:b.id, act:b.type });
        return { act:b.type, blockId:b.id };
      }
    }
    return null;
  }
  const fired = (ev, s) => ev==='always' ? true : !!(s.events && s.events[ev]);
  function read(id, s){
    const v=(s.read||{})[id];
    return typeof v==='number' ? v : 0;
  }
  function compare(v, op, n){
    if(op==='<') return v<n;
    if(op==='>') return v>n;
    /* Equality on a measured distance would almost never come out true,
       so "=" means "as near as makes no difference" — within half a
       unit. A child writing "if distance = 3" means "when I get there". */
    return Math.abs(v-n)<0.5;
  }

  /* ------------------------------------------------------ readability
     The trace, said out loud. The arena prints this under the fight as
     it happens, which is what turns a match into a debugger. */
  function say(step){
    if(step.kind==='event') return (EVENTS.find(e=>e.id===step.ev)||{label:step.ev}).label;
    if(step.kind==='test'){
      const s=SENSORS.find(x=>x.id===step.sensor)||{label:step.sensor};
      return s.label+' = '+round(step.value)+'  ·  IF '+s.label+' '+step.op+' '+step.n;
    }
    if(step.kind==='action') return (ACTIONS[step.act]||{label:step.act}).label;
    if(step.kind==='stall') return step.why;
    return '';
  }
  const round = v => Math.round(v*10)/10;

  const API={ EVENTS, EVENT_IDS, SENSORS, SENSOR_IDS, OPS, ACTIONS, PARTS,
              partActions, partById, countBlocks, validate, decide, say };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.MECHACODE=API;
})(typeof self!=='undefined' ? self : this);
