/* =====================================================================
   LOGIC — the decision engine every Koro machine thinks with, and the
   case file of THE ENGINEER'S TRAIL, with no screen attached.

   It lives on its own for the same reason program.js does: a lesson
   about conditions is only worth anything if the thing a student tests
   in the inspector is the same thing the world obeys, and the only way
   to be sure of that is one evaluator with no DOM in it, called by both
   — and tested under Node, where there is no DOM to call it from.

   A CONDITION is a little tree, not a string:

     {k:'var', v:'badge_valid'}          a Boolean the machine can read
     {k:'not', a}                        NOT a
     {k:'and', a, b} / {k:'or', a, b}    both / either
     {k:'cmp', v:'bay', op:'==', n:17}   a comparison against a number

   Strings would have been shorter and would have made the inspector a
   text box. A tree can be DRAWN — each leaf is a chip you can turn on
   and off, each junction is a row that says what it is waiting for —
   which is the whole difference between reading a condition and
   experimenting on one.

   A RULE is an ordered ladder of branches:

     [ {kind:'if',   cond, action},
       {kind:'elif', cond, action},
       {kind:'else',        action} ]

   run() walks it in order and stops at the first branch that is true,
   and it reports WHICH BRANCHES IT NEVER LOOKED AT. That report is the
   lesson at the maintenance room: a branch below a true one is not
   false, it is unasked — which is why moving a line changes an answer
   without changing a single condition.

   Everything below the engine is the case: the machines, the people,
   what they know, and what has to be true before somebody can be
   accused. It is data, so a second mission is a second table rather
   than a second file of code.
   ===================================================================== */
(function(root){

  /* ------------------------------------------------------- conditions */
  const VAR = v => ({ k:'var', v });
  const NOT = a => ({ k:'not', a });
  const AND = (a,b) => ({ k:'and', a, b });
  const OR  = (a,b) => ({ k:'or',  a, b });
  const CMP = (v,op,n) => ({ k:'cmp', v, op, n });

  /* Every operator in one table, so a new one is a row rather than a
     branch in three different functions. */
  const OPS = {
    '==': (a,b)=>a===b, '!=': (a,b)=>a!==b,
    '<':  (a,b)=>a<b,   '<=': (a,b)=>a<=b,
    '>':  (a,b)=>a>b,   '>=': (a,b)=>a>=b
  };

  /* What a machine's own state says this variable is right now. Missing
     is false rather than an error: a sensor nobody has wired up reads
     nothing, which is exactly what a machine does with it. */
  function read(state, name){
    const v = state ? state[name] : undefined;
    return v===undefined ? false : v;
  }

  function value(node, state){
    if(!node) return false;
    switch(node.k){
      case 'var': return !!read(state, node.v);
      case 'not': return !value(node.a, state);
      case 'and': return value(node.a, state) && value(node.b, state);
      case 'or':  return value(node.a, state) || value(node.b, state);
      case 'cmp': {
        const f = OPS[node.op];
        return f ? !!f(read(state, node.v), node.n) : false;
      }
      default: return false;
    }
  }

  /* The condition as a student would write it. Brackets only where the
     shape needs them — `a and b or c` is a different question from
     `a and (b or c)` and a nine-year-old should be able to see which
     one is on the screen. */
  function text(node){
    if(!node) return 'True';
    switch(node.k){
      case 'var': return node.v;
      case 'not': return 'not ' + (node.a && (node.a.k==='and'||node.a.k==='or')
                                   ? '('+text(node.a)+')' : text(node.a));
      case 'and': return [node.a,node.b].map(x=>
                    x.k==='or' ? '('+text(x)+')' : text(x)).join(' and ');
      case 'or':  return [node.a,node.b].map(text).join(' or ');
      case 'cmp': return node.v+' '+node.op+' '+node.n;
      default: return 'True';
    }
  }

  /* Every variable the condition reads, in the order it reads them —
     which is the order the inspector lays its switches out in, so the
     switches and the sentence agree. */
  function names(node, out){
    out = out || [];
    if(!node) return out;
    if(node.k==='var' || node.k==='cmp'){ if(out.indexOf(node.v)<0) out.push(node.v); return out; }
    if(node.k==='not') return names(node.a, out);
    names(node.a, out); names(node.b, out);
    return out;
  }
  function ruleNames(rule){
    const out=[];
    (rule.branches||[]).forEach(b=>names(b.cond, out));
    return out;
  }

  /* --------------------------------------------------------- the ladder
     The one function the whole mission turns on. It answers three
     questions at once, because all three are the lesson:

       which branch RAN
       what each branch it LOOKED AT came out as
       which branches it never reached at all                         */
  function run(rule, state){
    const trace=[], list=(rule && rule.branches) || [];
    let taken=-1;
    for(let i=0;i<list.length;i++){
      const b=list[i];
      if(taken>=0){                       // already answered: never asked
        trace.push({ i, kind:b.kind, text:b.cond?text(b.cond):null,
                     tested:false, value:null, ran:false, action:b.action });
        continue;
      }
      if(b.kind==='else'){
        taken=i;
        trace.push({ i, kind:'else', text:null, tested:true, value:true,
                     ran:true, action:b.action });
        continue;
      }
      const v=value(b.cond, state);
      if(v) taken=i;
      trace.push({ i, kind:b.kind, text:text(b.cond), tested:true, value:v,
                   ran:v, action:b.action });
    }
    const hit = taken>=0 ? list[taken] : null;
    return { branch:taken, action: hit ? hit.action : null,
             note: hit ? (hit.note||null) : null, trace };
  }

  /* MOVE A LINE. The maintenance room's whole idea is that the order of
     a ladder is part of its meaning, so the order has to be something a
     player can actually change — and whichever branch ends up on top is
     the `if`, because a ladder that starts with `elif` is not a ladder.
     An `else` is pinned to the bottom: it is not a condition and there
     is nothing for it to be above. */
  function reorder(rule, from, to){
    const list=(rule.branches||[]).slice();
    const tail=[];
    while(list.length && list[list.length-1].kind==='else') tail.unshift(list.pop());
    if(from<0 || from>=list.length || to<0 || to>=list.length) return rule;
    list.splice(to, 0, list.splice(from,1)[0]);
    const fixed=list.map((b,i)=>Object.assign({}, b, { kind: i===0 ? 'if' : 'elif' }));
    return Object.assign({}, rule, { branches: fixed.concat(tail) });
  }

  /* The rule as source. This is what a machine's panel prints, and it is
     generated rather than typed out beside the tree, so a rule cannot be
     shown doing one thing and do another. */
  function source(rule){
    const out=[];
    (rule.branches||[]).forEach(b=>{
      out.push(b.kind==='else' ? 'else:' : b.kind+' '+text(b.cond)+':');
      out.push('    '+b.action);
    });
    return out;
  }

  /* EVERY COMBINATION, worked. The gate's lesson is a truth table and a
     truth table is not a thing to hand-write twice. Capped at four
     switches — sixteen rows is already the most anybody reads. */
  function table(rule, vars){
    const list=(vars||ruleNames(rule)).slice(0,4);
    const rows=[];
    for(let m=0; m < (1<<list.length); m++){
      const st={};
      list.forEach((n,i)=>{ st[n] = !!(m & (1<<(list.length-1-i))); });
      const r=run(rule, st);
      rows.push({ state:st, branch:r.branch, action:r.action });
    }
    return { vars:list, rows };
  }

  /* =================================================================
     THE CASE — The Engineer's Trail.
     ================================================================= */

  /* The codes the whole mystery turns on. Written once: four machines
     and three witnesses all point at the same string, and a trail made
     of four copies of a typo is not a trail. */
  const CODE = 'M-4471';
  const CREW = 'MAINT CREW 4';
  const NIGHT = 'the 14th';

  /* ------------------------------------------------------- the machines
     Each one is a rule, the switches that feed it, what its actions do
     to the world, and what it is hiding. `teach` is what the debrief at
     the end counts up — the mission reports what a student actually
     used, not what the designer hoped they would. */
  const MACHINES = [
    /* 1. THE BAY SENSOR — a bare `if`. No else, nothing on the other
       side: a condition is true and something happens, or it is not and
       nothing does. Everything after this adds to it. */
    { id:'sensor', em:'\u{1F4E1}', name:'BAY SENSOR', where:'depot',
      teach:'if', concept:'if',
      sub:'Reads the pad under Bay 14 and tells the robot when a package is down.',
      vars:[{ v:'package_on_pad', hint:'The weight plate under the bay. It is what the sensor can actually see.' }],
      rule:{ branches:[
        { kind:'if', cond:VAR('package_on_pad'), action:'mark_delivered()',
          note:'The sensor tells the robot the package is down.' }
      ]},
      /* the whole point of a bare if: when it is false the machine does
         NOTHING, and nothing is a result too */
      falls:'Nothing. There is no else — the sensor just says nothing at all.',
      lead:'The pad under Bay 14 has been dead since the 14th. The sensor never fires, so the robot is never told it has arrived.',
      log:'02:02 · BAY 14 PAD — INPUT DISCONNECTED · by '+CODE },

    /* 2. THE DELIVERY ROBOT — if / else. Two roads out of one question,
       and the robot is standing on the wrong one. */
    { id:'robot', em:'\u{1F916}', name:'DELIVERY ROBOT KR-9', where:'depot',
      teach:'if / else', concept:'else',
      sub:'Carries what the depot gives it, and decides for itself when it is finished.',
      vars:[{ v:'package_delivered', hint:'What the bay sensor told it. Nobody has told it anything since the 14th.' }],
      rule:{ branches:[
        { kind:'if', cond:VAR('package_delivered'), action:'return_to_station()',
          note:'It comes home and puts down what it is carrying.' },
        { kind:'else', action:'continue_delivery()',
          note:'It sets off for the bay again. It has done this 1,206 times.' }
      ]},
      lead:'It is not broken and it is not lost. It is doing exactly what it was told, for ever, because the question it asks is never answered yes.',
      log:'02:02 · ROUTE REWRITTEN BAY 14 → BAY 17 · by '+CODE },

    /* 3. THE SECURITY GATE — or. The modification is one word long and
       it is the whole crime. */
    { id:'gate', em:'\u{1F6A7}', name:'PERIMETER GATE 3', where:'gate',
      teach:'or', concept:'or',
      sub:'The only way onto the loading side. It was a badge reader until somebody gave it a second way to say yes.',
      vars:[{ v:'badge_valid', hint:'A real badge, read at the post. You have not got one.' },
            { v:'maintenance_override', hint:'A code a maintenance crew can key in when a badge reader fails.' }],
      was:{ branches:[
        { kind:'if', cond:VAR('badge_valid'), action:'open_gate()' },
        { kind:'else', action:'deny_entry()' } ]},
      rule:{ branches:[
        { kind:'if', cond:OR(VAR('badge_valid'), VAR('maintenance_override')),
          action:'open_gate()', note:'The barrier drops. Either answer was enough.' },
        { kind:'else', action:'deny_entry()', note:'It stays down. Both answers were no.' }
      ]},
      lead:'Two ways in where there used to be one. Find the combination that opens it without a badge — that is the combination somebody used.',
      log:'02:14 · OPENED · badge_valid=FALSE · maintenance_override=TRUE · code '+CODE },

    /* 4. THE TRANSIT CAR — and. Both, or it does not happen, which is
       why one stop at a closed station is not an accident. */
    { id:'transit', em:'\u{1F686}', name:'TRANSIT CAR 2', where:'transit',
      teach:'and', concept:'and',
      sub:'Runs the loop line. It has no reason to stop at a station that closed four years ago.',
      vars:[{ v:'authorized_vehicle', hint:'Whether this car is cleared to leave the loop.' },
            { v:'emergency_signal', hint:'Raised from a handset. Somebody has to actually press it.' }],
      rule:{ branches:[
        { kind:'if', cond:AND(VAR('authorized_vehicle'), VAR('emergency_signal')),
          action:'stop_at_station()', note:'It pulls in at the old platform and opens its doors.' },
        { kind:'else', action:'continue_route()', note:'It runs straight past.' }
      ]},
      lead:'One of these on its own does nothing. It stopped, so both were true — and one of them is a button somebody had to hold.',
      log:'02:31 · STOP AT OLD YARD · handset '+CODE+' · held 41s' },

    /* 5. THE MAINTENANCE DOOR — if / elif / else, and the order of it is
       the thing that was hidden. */
    { id:'door', em:'\u{1F510}', name:'MAINTENANCE DOOR', where:'maint',
      teach:'if / elif / else', concept:'elif',
      sub:'Four ways to ask one question, and it only ever answers the first one that is true.',
      vars:[{ v:'emergency', hint:'A building-wide alarm. It opens everything, and it writes nothing down.' },
            { v:'maintenance_mode', hint:'A crew signing in to work. This branch logs who, and when.' },
            { v:'employee_badge', hint:'An ordinary badge. It asks somebody upstairs first.' }],
      rule:{ branches:[
        { kind:'if',   cond:VAR('emergency'), action:'unlock()',
          note:'Open. Nothing is written to the log — an emergency has no time for paperwork.' },
        { kind:'elif', cond:VAR('maintenance_mode'), action:'unlock_and_log()',
          note:'Open, and the log gets a name and a time.' },
        { kind:'elif', cond:VAR('employee_badge'), action:'request_confirmation()',
          note:'It asks the supervisor. Somebody has to answer.' },
        { kind:'else', action:'remain_locked()', note:'Nothing happens. The door stays shut.' }
      ]},
      /* The experiment that finishes the mission's teaching: the same
         three switches, the same four branches, one line moved. */
      swap:{ from:0, to:1,
        ask:'Move maintenance_mode above emergency and run the same test again.',
        found:'Same switches. Same branches. A different answer — and this time it writes a name down.' },
      lead:'The maintenance log for '+NIGHT+' is blank. Not wiped — blank. Work out which branch opened this door and you will know why nothing was ever written.',
      log:'02:48 · UNLOCK · branch 1 (emergency) · NOT LOGGED · override '+CODE },

    /* 6. THE ENGINEER'S TERMINAL — everything at once, and the only
       machine whose switches the player does not get to set. They are
       set by what has actually been found. */
    { id:'terminal', em:'\u{1F5A5}', name:'ENGINEER’S TERMINAL', where:'eng',
      teach:'combining conditions', concept:'combine',
      sub:'Ilana Vey’s own machine. It has been waiting four years for somebody to come and run it.',
      /* locked:true — the inspector shows these as read-only readings off
         the notebook rather than as switches, because the whole point is
         that a cross-reference is only as true as the evidence under it */
      locked:true,
      vars:[{ v:'depot_override',   hint:'The robot\u2019s route, rewritten at 02:02.' },
            { v:'gate_override',    hint:'The gate, opened at 02:14 with no badge.' },
            { v:'transit_override', hint:'The car, stopped at the old yard at 02:31.' },
            { v:'door_override',    hint:'The door, unlocked at 02:48 and never logged.' }],
      rule:{ branches:[
        { kind:'if',
          cond:AND(AND(VAR('depot_override'), VAR('gate_override')),
                   AND(VAR('transit_override'), VAR('door_override'))),
          action:'one_operator()',
          note:'All four overrides carry one code: '+CODE+' · '+CREW+'.' },
        { kind:'elif',
          cond:OR(OR(VAR('depot_override'), VAR('gate_override')),
                  OR(VAR('transit_override'), VAR('door_override'))),
          action:'partial_trail()',
          note:'Some of it. Not enough to put one person at all four machines.' },
        { kind:'else', action:'no_trail()', note:'Nothing to cross-reference yet.' }
      ]},
      lead:'Four machines, four overrides. Cross-reference them.' }
  ];

  const machine = id => MACHINES.find(m=>m.id===id) || null;

  /* -------------------------------------------------------- the people
     Nobody here knows the answer. Each of them knows ONE true thing and
     has an honest reason to know it, and the reason is what makes them
     worth walking back to: the officer knows what a gate log looks like
     and nothing about a delivery round, and the dispatcher is the other
     way about.

     `need` is what has to be in the notebook before a question is worth
     asking. It is not a lock so much as a reason: a student who has not
     seen the gate log has no question about it to ask. */
  const PEOPLE = [
    { id:'dima', name:'DIMA OKONJO', role:'depot dispatcher', em:'\u{1F4E6}',
      at:'depot', tint:0xffd8a8,
      intro:'KR-9 has been going out to Bay 17 and coming back with the same crate since the 14th. I have re-tasked it four times. It goes to 17.',
      lines:[
        { id:'d1', q:'Why Bay 17? What is in Bay 17?',
          a:'Nothing is in Bay 17. It has been empty since we moved the cold store. That is what makes it a good place to put something you do not want signed for — nobody counts an empty bay.',
          clue:'bay17' },
        { id:'d2', q:'Who re-tasked the robot on the 14th?', need:'robot_rule',
          a:'A night dispatch. It came in at two in the morning under a maintenance code, not under a person — I only ever see the code. '+CODE+', if that means anything to you.',
          clue:'code_depot' },
        { id:'d3', q:'Does the depot sign anything out to maintenance crews?', need:'code_depot',
          a:'Handsets. Emergency handsets, one per crew, signed out at the gate post. Ask Vale — she keeps that book.' }
      ] },
    { id:'vale', name:'DARA VALE', role:'security officer', em:'\u{1F6E1}',
      at:'gate', tint:0x8fd3ff,
      intro:'Gate 3 opened at 02:14 on the 14th and I was standing at this post. Nobody walked through it with a badge. I know, because I would have read it.',
      lines:[
        { id:'v1', q:'Then how did it open?',
          a:'That is what I have been asking for four years. A badge reader that opens for nobody is a broken reader, they told me. It is not broken. Look at it yourself.',
          clue:'gate_open' },
        { id:'v2', q:'The log says maintenance_override was TRUE.', need:'gate_rule',
          a:'Then it was an override. Those are issued to a CREW, not to a person — that is the whole trouble with them. The code on that one is '+CODE+'. Crew four.',
          clue:'code_gate' },
        { id:'v3', q:'Could it have been your badge?', need:'code_gate',
          a:'My badge is valid, so the log would say badge_valid TRUE. It says FALSE. Whoever came through had no badge at all — which rules out every badge holder in this district, me first.',
          clue:'clears_vale' },
        { id:'v4', q:'Who signed out crew four’s emergency handset?', need:'code_transit',
          a:'Signed out on the 12th, never returned. Signed out to the crew, again. I can tell you it was used — I cannot tell you by whom. Nell keeps the roster.' }
      ] },
    { id:'rook', name:'ROOK SANDOVAL', role:'transit operator', em:'\u{1F686}',
      at:'transit', tint:0xa8e6cf,
      intro:'Car 2 stopped at the old yard. That station shut four years ago. There is no platform crew, no lighting, and no reason on this line to stop there.',
      lines:[
        { id:'r1', q:'Can a car stop somewhere on its own?',
          a:'It cannot. It needs to be cleared to leave the loop AND it needs an emergency signal, both, or it runs straight through. One of those without the other is nothing.',
          clue:'station_stop' },
        { id:'r2', q:'Where does an emergency signal come from?', need:'transit_rule',
          a:'A handset. Somebody has to hold the button down — mine logged 41 seconds. That is not a fault, that is a thumb. And the handset was '+CODE+'.',
          clue:'code_transit' },
        { id:'r3', q:'What is at the old yard?', need:'code_transit',
          a:'Dust and a drag mark. I went and looked, the week after. Something heavy went along that platform and nobody ever told me what.' }
      ] },
    { id:'nell', name:'NELL ARVIDSEN', role:'maintenance technician', em:'\u{1F527}',
      at:'maint', tint:0xcdb4f6,
      intro:'You are the first person to come down here about this. I have been saying for four years that somebody changed my machines.',
      lines:[
        { id:'n1', q:'Changed them how?',
          a:'Somebody added conditions. Not broken — ADDED. A gate with a second way to say yes, a door that answers on the wrong branch. That is not wear. That is somebody who could write.',
          clue:'modified' },
        { id:'n2', q:'Who could write like that?', need:'modified',
          a:'Ilana Vey. Systems engineer here for eleven years. She left on the 9th and her access was revoked the same day — five days before any of this. Whatever she did, she did it before.',
          clue:'clears_ilana' },
        { id:'n3', q:'The maintenance log for the 14th is blank.', need:'door_rule',
          a:'Of course it is. An emergency unlock is not logged — that branch comes first and it never gets as far as the one that writes. Somebody knew the order.',
          clue:'blank_log' },
        { id:'n4', q:'Who is on crew four?', need:'code_door',
          a:'Crew four is a night crew and on the 14th it was one man: Marek Tolan, night logistics supervisor. I am crew two. It is on the roster on the wall behind you.',
          clue:'roster' }
      ] }
  ];
  const person = id => PEOPLE.find(p=>p.id===id) || null;

  /* --------------------------------------------------------- the clues
     What goes in the notebook, and which drawer it goes in. Anything
     that is found in the world or said out loud is here; nothing is
     written anywhere else, so the notebook cannot disagree with the
     game. */
  const CLUES = {
    /* machine rules, filed as the player reads each machine */
    sensor_rule:{ tab:'rules', head:'Bay 14 sensor', body:'if package_on_pad: mark_delivered() — and nothing at all when it is false.' },
    robot_rule: { tab:'rules', head:'Delivery robot KR-9', body:'if package_delivered: return_to_station() else: continue_delivery(). Route rewritten Bay 14 → Bay 17 at 02:02, under '+CODE+'.' },
    gate_rule:  { tab:'rules', head:'Perimeter gate 3', body:'if badge_valid or maintenance_override: open_gate(). The `or` was added — the gate used to ask one question.' },
    transit_rule:{tab:'rules', head:'Transit car 2', body:'if authorized_vehicle and emergency_signal: stop_at_station(). Both, or it runs past.' },
    door_rule:  { tab:'rules', head:'Maintenance door', body:'if emergency: unlock() / elif maintenance_mode: unlock_and_log() / elif employee_badge: request_confirmation() / else: remain_locked().' },
    order_matters:{tab:'rules', head:'The order is the hiding place', body:'emergency is tested first, so maintenance_mode is never asked — and it is maintenance_mode that writes the log. Move it up and the same inputs leave a name behind.' },

    /* physical things */
    crate:   { tab:'evidence', head:'Crate in Bay 17', body:'Sealed, unsigned, and never counted. The robot has been carrying it out and back since the 14th.' },
    manifest:{ tab:'evidence', head:'Loading stub, secure side', body:'One line, no signature: OUTBOUND · '+NIGHT+' · 02:20 · authorised '+CODE+'.' },
    tag:     { tab:'evidence', head:'Tool tag, old yard platform', body:'A drag mark in the dust, and a maintenance tool tag at the end of it: '+CREW+' · '+CODE+'.' },
    note:    { tab:'evidence', head:'Ilana Vey’s note', body:'“I could not make anyone listen. So I taught the machines to keep saying it until somebody read them.”' },

    /* what people know */
    bay17:      { tab:'people', head:'Dima — Bay 17 is empty', body:'Nothing is stored there and nothing is counted there. A good place to leave something nobody signs for.' },
    gate_open:  { tab:'people', head:'Vale — nobody walked through', body:'She was at the post at 02:14. The gate opened and no badge was read.' },
    station_stop:{tab:'people', head:'Rook — a car cannot stop itself', body:'It needs clearance AND a signal. Either one alone does nothing.' },
    modified:   { tab:'people', head:'Nell — conditions were ADDED', body:'Not faults. Somebody who could write changed what the machines ask.' },
    blank_log:  { tab:'people', head:'Nell — why the log is blank', body:'An emergency unlock is not logged, and it is tested first. Nothing was erased; nothing was ever written.' },
    roster:     { tab:'people', head:'Nell — crew four, that night', body:CREW+' ran one man on '+NIGHT+': Marek Tolan, night logistics supervisor.' },
    clears_vale:{ tab:'people', head:'Vale is ruled out', body:'The gate log says badge_valid = FALSE. A badge holder walking through would read TRUE. Whoever came through had no badge.' },
    clears_ilana:{tab:'people', head:'Ilana Vey is ruled out', body:'She left on the 9th and her access was revoked the same day — five days before '+NIGHT+'.' },

    /* the four overrides: the spine of the case */
    code_depot:  { tab:'evidence', head:'Override 1 of 4 — depot', body:'02:02 · robot route rewritten · '+CODE, sets:'depot_override' },
    code_gate:   { tab:'evidence', head:'Override 2 of 4 — gate', body:'02:14 · opened with no badge · '+CODE, sets:'gate_override' },
    code_transit:{ tab:'evidence', head:'Override 3 of 4 — transit', body:'02:31 · stop at the old yard · '+CODE, sets:'transit_override' },
    code_door:   { tab:'evidence', head:'Override 4 of 4 — maintenance', body:'02:48 · unlocked on emergency, unlogged · '+CODE, sets:'door_override' }
  };

  /* --------------------------------------------------------- the night
     Four events with four times on four machines. The player is not
     asked to remember them: every time is printed on the machine it
     came off, which is why this can be an ordering puzzle rather than
     a memory test. */
  const TIMELINE = [
    { id:'robot',   at:'02:02', what:'A delivery robot carries a sealed crate to an empty bay.' },
    { id:'gate',    at:'02:14', what:'The perimeter gate opens with no badge, on a maintenance override.' },
    { id:'transit', at:'02:31', what:'A transit car leaves the loop and stops at the abandoned station.' },
    { id:'door',    at:'02:48', what:'The maintenance door unlocks on the branch that writes nothing down.' }
  ];
  const ORDER = TIMELINE.map(e=>e.id);

  /* -------------------------------------------------------- the accusal
     Four names, one answer, and a reason for each of the other three.
     Being wrong costs a sentence of explanation and nothing else — a
     detective game that punishes a theory is a game that teaches you
     not to have one. */
  const SUSPECTS = [
    { id:'tolan', name:'MAREK TOLAN', role:'night logistics supervisor · '+CREW,
      right:true,
      why:'One man on crew four on '+NIGHT+', and crew four’s code is on all four overrides: the robot at 02:02, the gate at 02:14, the car at 02:31 and the door at 02:48.' },
    { id:'ilana', name:'ILANA VEY', role:'former systems engineer',
      why:'She wrote the modifications — but her access ended on the 9th, five days before. The trail is hers. The night is not.' },
    { id:'vale',  name:'DARA VALE', role:'security officer',
      why:'The gate log reads badge_valid = FALSE. Any badge holder walking through would have made it TRUE. It rules her out rather than in.' },
    { id:'nell',  name:'NELL ARVIDSEN', role:'maintenance technician · crew 2',
      why:'Crew two, not crew four, and she is the one who kept reporting the machines. The override code is not hers.' }
  ];

  /* What the debrief counts up. One row per idea, and each names the
     machine the student actually met it on, because "you used elif" means
     nothing and "the door only ever answers the first true branch" is
     the thing they will still have in a week. */
  const LESSONS = [
    { k:'if',   head:'if',            on:'sensor',
      body:'A condition is a question with a yes or a no. If the answer is yes, something happens. The bay sensor has nothing else — when it is no, nothing happens at all, and nothing is an answer too.' },
    { k:'else', head:'else',          on:'robot',
      body:'else is the other road. KR-9 goes home or it sets off again, and there is no third thing it can do — which is why it could be trapped by feeding it one wrong answer for ever.' },
    { k:'or',   head:'or',            on:'gate',
      body:'or needs only one of them. That is why adding one word to the gate was enough: the badge did not have to be valid any more, it only had to not be the only way in.' },
    { k:'and',  head:'and',           on:'transit',
      body:'and needs both. A car that stops has been cleared AND signalled, so a stop at a closed station is two deliberate things, not one fault.' },
    { k:'elif', head:'elif, and order', on:'door',
      body:'elif is only asked when everything above it was false. emergency sits above maintenance_mode, so the branch that writes the log was never reached — the record was not erased, it was never written.' },
    { k:'combine', head:'conditions together', on:'terminal',
      body:'Four separate machines, four separate answers, and one and-of-all-four that only comes out true if the same person is behind every one of them.' }
  ];

  const API = { VAR, NOT, AND, OR, CMP, OPS,
                value, text, names, ruleNames, run, reorder, source, table,
                MACHINES, machine, PEOPLE, person, CLUES,
                TIMELINE, ORDER, SUSPECTS, LESSONS,
                CODE, CREW, NIGHT };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.KLOGIC=API;
})(typeof self!=='undefined' ? self : this);
