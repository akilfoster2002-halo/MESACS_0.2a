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

  const DUMMY = 'Dummy';

  /* ------------------------------------------------------------ punch
     The one that shows what an attack IS: go forward, check whether
     anything is in front of you, tell it, then be stuck for a moment. */
  const PUNCH = {
    id:'punch', name:'PUNCH', em:'\u{1F44A}',
    blurb:'Lunge, check whether the dummy is in reach, tell it you hit it, '+
          'then be stuck for a moment while you pull your arm back.',
    teaches:'a function · a variable · a counted loop · a test on a sensor · a message',
    vars:['swinging'],
    key:'space',
    tune:[
      { what:'repeat (4)',            does:'how far the lunge carries you' },
      { what:'change x by (0.6)',     does:'how fast you close the gap' },
      { what:'distance to < (6)',     does:'your reach — how near it has to be to count' },
      { what:'wait (0.2) seconds',    does:'recovery: how long you cannot do anything else' }
    ],
    procs:[{
      name:'punch', params:[],
      body:[
        B('data.set',   { v:'swinging', n:1 }),
        B('ctrl.repeat',{ n:4 }, [ B('motion.changeBy',{ a:'x', n:0.6 }) ]),
        B('ctrl.if',    { c: B('op.lt', { a: B('sense.dist',{ o:DUMMY }), b:6 }) },
                        [ B('event.send', { m:'hit' }) ]),
        B('ctrl.wait',  { n:0.2 }),
        B('ctrl.repeat',{ n:4 }, [ B('motion.changeBy',{ a:'x', n:-0.6 }) ]),
        B('data.set',   { v:'swinging', n:0 })
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'space' }) }, [ call('punch') ]) ]) ]
    }]
  };

  /* ------------------------------------------------------------ block
     The one that shows what a VARIABLE is for. `guard` does nothing on
     its own — it is a fact about you that something else reads later,
     which is most of what state is. */
  const BLOCK = {
    id:'block', name:'BLOCK', em:'\u{1F6E1}',
    blurb:'Put a guard up and hold it for a moment. Nothing happens straight '+
          'away — `guard` is a fact about you that the dummy’s swing checks later.',
    teaches:'a variable as STATE · something true for a while rather than all at once',
    vars:['guard'],
    key:'s',
    tune:[
      { what:'wait (0.5) seconds', does:'how long the guard stays up before it drops' },
      { what:'set [guard] to 1',   does:'try 0 and watch the guard stop working entirely' }
    ],
    procs:[{
      name:'block', params:[],
      body:[
        B('data.set',   { v:'guard', n:1 }),
        B('looks.say',  { s:'guard up' }),
        B('ctrl.wait',  { n:0.5 }),
        B('data.set',   { v:'guard', n:0 }),
        B('looks.say',  { s:'' })
      ]
    }],
    scripts:[{
      hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.if', { c:B('sense.key',{ k:'s' }) }, [ call('block') ]) ]) ]
    }]
  };

  /* ------------------------------------------------------------ dodge
     The one that shows a loop doing real work. The distance you travel
     is repeat × step, which is multiplication a student can feel rather
     than be told. */
  const DODGE = {
    id:'dodge', name:'DODGE', em:'\u{1F4A8}',
    blurb:'Throw yourself backwards out of the way, and be untouchable while '+
          'you are moving. How far you get is the repeat times the step.',
    teaches:'a loop that adds up · two numbers multiplying into one result',
    vars:['dodging'],
    key:'d',
    tune:[
      { what:'repeat (8)',          does:'how many steps the dodge takes' },
      { what:'change x by (-0.5)',  does:'how big each step is — and which way you go' },
      { what:'wait (0.15) seconds', does:'how long you stay untouchable after you land' }
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

  /* --------------------------------------------------------- the reply
     WITHOUT THIS, `guard` AND `dodging` ARE NUMBERS NOBODY READS. A
     variable that nothing ever checks is not state, it is litter — so
     the template that sets them comes with the one that tests them, and
     the test is written in the same blocks as everything else.

     It is deliberately the most readable script in the set, because it
     is the one that shows a student what their own variables were FOR. */
  const ANSWER = {
    id:'answer', name:'TAKE A HIT', em:'❕',
    blurb:'What happens when the dummy swings at you. Reads `guard` and '+
          '`dodging` — the two facts the other templates set — and decides '+
          'whether you got away with it.',
    teaches:'reading state back · `or` · if / else',
    vars:['guard','dodging'],
    tune:[
      { what:'change x by (-3)', does:'how far a hit knocks you back' },
      { what:'‹guard› or ‹dodging›', does:'take one out and see which one was saving you' }
    ],
    procs:[],
    scripts:[{
      hat:B('event.recv', { m:'swing' }),
      body:[
        B('ctrl.ifelse',
          { c: B('op.or', { c: B('op.eq',{ a:get('guard'),   b:1 }),
                            d: B('op.eq',{ a:get('dodging'), b:1 }) }) },
          [ B('looks.sayFor', { s:'safe!', n:1 }) ],
          [ B('looks.sayFor', { s:'hit!',  n:1 }),
            B('motion.changeBy', { a:'x', n:-3 }) ])
      ]
    }]
  };

  const LIST=[PUNCH, BLOCK, DODGE, ANSWER];
  const byId = id => LIST.find(t=>t.id===id) || null;

  /* ------------------------------------------------------- the dummy
     What the training dummy comes with. It is not an opponent and it has
     no idea what a fight is: it stands still, it swings on a timer, and
     it flinches when it is told it was hit. Three short scripts, all of
     them readable, all of them editable — a student who wants it to
     swing faster changes the 3.

     THE DUMMY IS THE SECOND OBJECT, and that is most of its job. Every
     sensing block worth having — `touching?`, `distance to` — needs
     something that is not you, and broadcast needs somebody to talk to. */
  const dummyScripts = () => ([
    /* IT ROCKS BACK AND COMES BACK. The first version only had the
       first half of this — `change x by 1.5` and nothing to undo it —
       so every landed punch shoved the dummy a metre and a half further
       away and it never returned. Twenty punches into a lesson it was
       off the end of the floor and nothing anybody threw could reach it.
       A punchbag swings and settles; this one does too. */
    { hat:B('event.recv', { m:'hit' }),
      body:[ B('looks.say', { s:'ow!' }),
             B('motion.changeBy', { a:'x', n:1.5 }),
             B('ctrl.wait', { n:0.25 }),
             B('motion.changeBy', { a:'x', n:-1.5 }),
             B('looks.say', { s:'' }) ] },
    { hat:B('event.flag'),
      body:[ B('ctrl.forever', {}, [
               B('ctrl.wait', { n:3 }),
               B('looks.say', { s:'swinging!' }),
               B('event.send', { m:'swing' }),
               B('ctrl.wait', { n:0.6 }),
               B('looks.say', { s:'' }) ]) ] }
  ]);

  const API={ LIST, byId, DUMMY, dummyScripts, B };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.TEMPLATES=API;
})(typeof self!=='undefined' ? self : this);
