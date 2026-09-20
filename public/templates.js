/* =====================================================================
   TEMPLATES — worked examples of a punch, a block and a dodge, written
   in blocks, meant to be taken apart.

   THERE IS NO `PUNCH` BLOCK, AND THERE IS NOT GOING TO BE ONE. A palette
   block called PUNCH teaches a student where the punch button is. What
   is in this file instead is a punch BUILT out of the things programming
   is actually made of:

       define punch
         set [swinging] to 1            ← state
         repeat (4)                     ← a loop
           change x by (0.6)            ← the lunge
         if ‹distance to [Dummy] < 6› then    ← a condition, on a reading
           broadcast [hit]              ← telling something else
         wait (0.2) seconds             ← the recovery you are stuck in
         repeat (4)
           change x by (-0.6)
         set [swinging] to 0

   Every idea in there is transferable: a function with a name, a
   variable holding state, a counted loop, a test on a sensor, a message
   to another object, and the fact that time passes while you are
   committed to something. None of it is about fighting. All of it is
   about programming, and it happens to add up to a punch.

   THE NUMBERS ARE THE LESSON. Each template carries a `tune` list — the
   numbers in it worth changing and what each one does — because "change
   0.6 to 2 and see what happens to your reach" is a better exercise than
   anything a paragraph could say. A student who makes the reach 20 has
   built a robot that hits from across the room and has learnt something
   true about constants.

   AND THEY ARE A STARTING POINT, NOT AN ANSWER. Installing one writes it
   into the project as ordinary blocks. There is nothing special about
   them afterwards: they can be edited, renamed, rearranged, deleted or
   thrown away, and nothing in the game knows which blocks came from here.

   No DOM. Node loads this too, because the tests read it.
   ===================================================================== */
(function(root){

  /* Shorthand, so the templates below read like the blocks they are. */
  const B = (op, args, body, body2) => {
    const b = { op, args: args || {} };
    if(body)  b.body  = body;
    if(body2) b.body2 = body2;
    return b;
  };
  const call = name => B('my.call', { p:name });
  const get  = v => B('data.get', { v });

  const FOE = 'Ambush';        // who you are fighting, and what to point a sensor at
  const ME  = 'Robot';

  /* ------------------------------------------------------------- jab
     THE CHEAP ONE. Everything interesting about it is the student's:
     when to throw it, whether they can afford it, how far the lunge
     carries and how long they are stuck afterwards. What is NOT theirs
     is what it costs and what it does — the referee owns those, and
     `set [light] to 1` is how you ask it for one. */
  const JAB = {
    id:'jab', name:'JAB', em:'\u{1F44A}',
    blurb:'The cheap punch. Check you can afford it, lunge, ask the referee '+
          'for a light one, then be stuck for a moment pulling your arm back.',
    teaches:'a function \u00b7 reading engine state before you spend it \u00b7 a counted loop \u00b7 a signal',
    vars:['swinging'],
    tune:[
      { what:'if ‹stamina > (25)›', does:'how much you insist on having left before you swing' },
      { what:'repeat (3)',          does:'how far the lunge carries you in' },
      { what:'wait (0.3) seconds',  does:'recovery \u2014 how long you cannot do anything else' }
    ],
    procs:[{
      name:'jab', params:[],
      body:[
        B('ctrl.if', { c: B('op.gt', { a:get('stamina'), b:25 }) }, [
          B('data.set',    { v:'swinging', n:1 }),
          B('ctrl.repeat', { n:3 }, [ B('motion.changeBy',{ a:'x', n:0.5 }) ]),
          B('data.set',    { v:'light', n:1 }),
          B('ctrl.wait',   { n:0.3 }),
          B('ctrl.repeat', { n:3 }, [ B('motion.changeBy',{ a:'x', n:-0.5 }) ]),
          B('data.set',    { v:'swinging', n:0 })
        ])
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'space' }) }, [ call('jab') ]) ]) ]
    }]
  };

  /* ------------------------------------------------------------ slam
     THE EXPENSIVE ONE, and the reason `stamina` is worth reading. It is
     bad value per point — twice the cost for a bit over twice the
     damage, and a shorter reach — so throwing it every time loses. */
  const SLAM = {
    id:'slam', name:'SLAM', em:'\u{1F4A5}',
    blurb:'The heavy punch. Costs more than twice a jab and reaches less far, '+
          'so it is only worth it when you are close and can afford it.',
    teaches:'the same shape as the jab, with different numbers \u2014 and why you compare them',
    vars:['swinging'],
    tune:[
      { what:'if ‹stamina > (50)›', does:'whether you keep enough in the tank to follow up' },
      { what:'wait (0.6) seconds',  does:'the long recovery \u2014 what a heavy really costs you' }
    ],
    procs:[{
      name:'slam', params:[],
      body:[
        B('ctrl.if', { c: B('op.gt', { a:get('stamina'), b:50 }) }, [
          B('data.set',    { v:'swinging', n:1 }),
          B('ctrl.repeat', { n:2 }, [ B('motion.changeBy',{ a:'x', n:0.5 }) ]),
          B('data.set',    { v:'heavy', n:1 }),
          B('ctrl.wait',   { n:0.6 }),
          B('ctrl.repeat', { n:2 }, [ B('motion.changeBy',{ a:'x', n:-0.5 }) ]),
          B('data.set',    { v:'swinging', n:0 })
        ])
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'w' }) }, [ call('slam') ]) ]) ]
    }]
  };

  /* ------------------------------------------------------------ block
     The one that shows what a VARIABLE is for. `guard` does nothing on
     its own — it is a fact about you that the REFEREE reads when
     somebody swings at you, which is most of what state is. */
  const BLOCK = {
    id:'block', name:'BLOCK', em:'\u{1F6E1}',
    blurb:'Put a guard up and hold it. Nothing happens straight away \u2014 `guard` '+
          'is a fact about you that the referee checks when a punch arrives.',
    teaches:'a variable as STATE \u00b7 something true for a while rather than all at once',
    vars:['guard'],
    tune:[
      { what:'wait (0.6) seconds', does:'how long the guard stays up before it drops' },
      { what:'set [guard] to 1',   does:'try 0 and watch the guard stop working entirely' }
    ],
    procs:[{
      name:'block', params:[],
      body:[
        B('data.set',  { v:'guard', n:1 }),
        B('looks.say', { s:'guard' }),
        B('ctrl.wait', { n:0.6 }),
        B('data.set',  { v:'guard', n:0 }),
        B('looks.say', { s:'' })
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'s' }) }, [ call('block') ]) ]) ]
    }]
  };

  /* ------------------------------------------------------------ dodge
     A loop doing real work: how far you get is repeat × step, which is
     multiplication a student can feel rather than be told. And backing
     off is how stamina comes back, so retreating is a tactic. */
  const DODGE = {
    id:'dodge', name:'DODGE', em:'\u{1F4A8}',
    blurb:'Throw yourself backwards, out of everybody\u2019s reach. Stamina only '+
          'comes back while you are not spending it, so this is how you afford '+
          'the next slam.',
    teaches:'a loop that adds up \u00b7 two numbers multiplying into one result',
    vars:['dodging'],
    tune:[
      { what:'repeat (8)',         does:'how many steps back the dodge takes' },
      { what:'change x by (-0.5)', does:'how big each step is \u2014 and which way you go' }
    ],
    procs:[{
      name:'dodge', params:[],
      body:[
        B('data.set',   { v:'dodging', n:1 }),
        B('ctrl.repeat',{ n:8 }, [ B('motion.changeBy',{ a:'x', n:-0.5 }) ]),
        B('ctrl.wait',  { n:0.15 }),
        B('data.set',   { v:'dodging', n:0 })
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'d' }) }, [ call('dodge') ]) ]) ]
    }]
  };

  /* -------------------------------------------------------- the plan
     NOT A MOVE — a strategy, and the one that shows what the numbers are
     FOR. It reads health, stamina and the gap, and decides. A student who
     has this and the moves has a robot that fights on its own, and the
     interesting work becomes changing its mind about when. */
  const PLAN = {
    id:'plan', name:'A PLAN', em:'\u{1F9E0}',
    blurb:'Fight without touching the keys. Close the distance, slam when you '+
          'can afford it, jab when you cannot, and back off when you are empty.',
    teaches:'nested conditionals \u00b7 reading engine state \u00b7 a strategy you can argue with',
    vars:[],
    tune:[
      { what:'‹distance to > (6)›',  does:'how close you insist on being before you swing' },
      { what:'‹stamina > (55)›',     does:'how rich you have to be to reach for the slam' },
      { what:'change x by (0.4)',    does:'how fast you back off when you are empty' }
    ],
    procs:[],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
        B('ctrl.ifelse', { c: B('op.gt', { a:B('sense.dist',{ o:FOE }), b:6 }) },
          [ B('motion.changeBy', { a:'x', n:0.3 }) ],
          [ B('ctrl.ifelse', { c: B('op.gt', { a:get('stamina'), b:55 }) },
              [ call('slam') ],
              [ B('ctrl.ifelse', { c: B('op.gt', { a:get('stamina'), b:30 }) },
                  [ call('jab') ],
                  [ B('motion.changeBy', { a:'x', n:0.4 }) ]) ]) ])
      ]) ]
    }]
  };

  const LIST=[JAB, SLAM, BLOCK, DODGE, PLAN];
  const byId = id => LIST.find(t=>t.id===id) || null;

  /* ======================================================= THE OPPONENT
     AMBUSH'S BRAIN, AND IT IS MEANT TO BE READ. It is written in exactly
     the blocks the student has, on an actor they can select in the
     editor, so "what is it doing and why does it keep beating me" is a
     question they can answer by looking rather than by guessing.

     That is the whole reason it is not a hidden function in the ring.
     An opponent you can read is a worked example that fights back: every
     decision in here is one a student can steal, and the first time
     somebody notices it backs off to recover and then copies that, they
     have learnt more about strategy than any amount of being told.

     THE STRATEGY, in order, because the order IS the strategy:

       too far away          → walk in
       close and rich        → slam
       close and comfortable → jab
       close and empty       → back off and let stamina come back

     It is deliberately beatable. It has no guard, it never dodges, and
     it commits to a slam whenever it can afford one — so a student who
     waits for the slam's long recovery and punishes it wins. Finding
     that out is the lesson. */
  const aiProcs = () => ([
    { name:'ai jab', params:[], body:[
        B('ctrl.if', { c: B('op.gt', { a:get('stamina'), b:25 }) }, [
          B('ctrl.repeat',{ n:3 }, [ B('motion.changeBy',{ a:'x', n:-0.5 }) ]),
          B('data.set',   { v:'light', n:1 }),
          B('ctrl.wait',  { n:0.35 }),
          B('ctrl.repeat',{ n:3 }, [ B('motion.changeBy',{ a:'x', n:0.5 }) ])
        ]) ] },
    { name:'ai slam', params:[], body:[
        B('ctrl.if', { c: B('op.gt', { a:get('stamina'), b:50 }) }, [
          B('looks.say',  { s:'big one' }),
          B('ctrl.repeat',{ n:2 }, [ B('motion.changeBy',{ a:'x', n:-0.5 }) ]),
          B('data.set',   { v:'heavy', n:1 }),
          B('ctrl.wait',  { n:0.7 }),
          B('looks.say',  { s:'' }),
          B('ctrl.repeat',{ n:2 }, [ B('motion.changeBy',{ a:'x', n:0.5 }) ])
        ]) ] }
  ]);

  const aiScripts = () => ([
    { hat:B('event.flag'), body:[
        B('ctrl.forever', {}, [
          B('ctrl.ifelse', { c: B('op.gt', { a:B('sense.dist',{ o:ME }), b:6 }) },
            /* too far: walk in. Slower than the player can run, so
               backing off always buys a moment. */
            [ B('motion.changeBy', { a:'x', n:-0.25 }) ],
            [ B('ctrl.ifelse', { c: B('op.gt', { a:get('stamina'), b:50 }) },
                [ B('my.call', { p:'ai slam' }) ],
                [ B('ctrl.ifelse', { c: B('op.gt', { a:get('stamina'), b:25 }) },
                    [ B('my.call', { p:'ai jab' }) ],
                    /* empty: back off and let it come back, which is the
                       one habit worth stealing off it */
                    [ B('motion.changeBy', { a:'x', n:0.35 }),
                      B('ctrl.wait', { n:0.1 }) ]) ]) ])
        ]) ] }
  ]);

  const API={ LIST, byId, FOE, ME, aiProcs, aiScripts, B };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.TEMPLATES=API;
})(typeof self!=='undefined' ? self : this);
