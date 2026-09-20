/* =====================================================================
   MECHACODE — what a key does, written as blocks.

   THE WHOLE LANGUAGE IS ONE SENTENCE:

       WHEN [D] IS PRESSED
         STEP RIGHT

   That is it. No sensors, no IF, no enemy, no arms. A program is a list
   of rules, a rule is a key and an action, and twenty times a second the
   robot is asked one question — of the keys being held down right now,
   which is the first rule that matches? — and does that one thing.

   WHY IT IS THIS SMALL. A student who writes that rule and then presses
   D has done the whole loop of programming in about ten seconds: they
   said what should happen, they made it happen, and they watched it
   happen to a thing with legs. Everything else — arms, sensors, the
   other robot, deciding for itself — gets built ON TOP of that sentence,
   and none of it teaches anything until that sentence is understood.
   This file used to hold all of it at once, and it was a wall.

   THE FIRST RULE WINS, which is the one rule about order in here and the
   reason every row can be moved up and down. Hold two keys that both say
   something and the robot does the top one — which is a thing a student
   can find out by holding two keys, and that is the best kind of thing
   to find out.

   THE TRACE IS WHY THIS IS NOT JUST A KEYMAP. Every decision comes back
   with the steps that led to it, and the ring prints them as they
   happen, in the same words the blocks are written in.

   No DOM. Node loads this too, because the tests run there.
   ===================================================================== */
(function(root){

  /* ------------------------------------------------------------- keys
     A short list on purpose: every key here is one a lab keyboard
     definitely has and one a student can find without looking, and a
     palette of seven is a lesson where a palette of a hundred is a
     reference manual.

     `id` is the browser's own KeyboardEvent.code, so what a program
     stores is exactly what gets tested at runtime and nothing has to be
     translated in between. */
  const KEYS = [
    { id:'ArrowLeft',  label:'← LEFT ARROW'  },
    { id:'ArrowRight', label:'→ RIGHT ARROW' },
    { id:'KeyA',       label:'A' },
    { id:'KeyD',       label:'D' },
    { id:'KeyW',       label:'W' },
    { id:'KeyS',       label:'S' },
    { id:'Space',      label:'SPACEBAR' }
  ];
  const KEY_IDS = KEYS.map(k=>k.id);
  const keyById = id => KEYS.find(k=>k.id===id) || null;
  const keyLabel = id => (keyById(id)||{label:id}).label;

  /* ---------------------------------------------------------- actions
     Two, because the feet are the only part of the robot wired up yet.
     A third is a row here and a case in the ring, which is the point of
     them living in a table rather than in an if.

     `axis` is what the ring does with it: -1 is left along the floor and
     +1 is right. An action with no axis is one the ring would have to be
     taught about separately, and there is no such thing yet. */
  const ACTIONS = {
    left : { label:'STEP LEFT',  axis:-1, help:'Move along the floor to your left.' },
    right: { label:'STEP RIGHT', axis: 1, help:'Move along the floor to your right.' }
  };
  const ACTION_IDS = Object.keys(ACTIONS);

  /* ----------------------------------------------------------- shape */
  function countBlocks(list){
    let n=0;
    for(const b of (list||[])){ n++; n+=countBlocks(b.body); }
    return n;
  }

  /* Checked before a program is allowed to drive anything. Every message
     is a sentence a student can act on, and every one names the block it
     is about so the editor can point at it. */
  function validate(program, rules){
    rules=rules||{};
    if(!Array.isArray(program))
      return { ok:false, errors:[{ msg:'That is not a program.' }], blocks:0 };
    const errs=[];
    const allow=new Set(rules.allow || ACTION_IDS);
    const limit=rules.limit || 12;
    const n=countBlocks(program);
    if(n>limit) errs.push({ code:'over-budget',
      msg:'That is '+n+' blocks and this robot holds '+limit+'.' });

    const used=new Set();
    for(const b of program){
      if(!b || b.type!=='when'){
        errs.push({ code:'loose-block', blockId:b&&b.id,
          msg:'Every block has to sit under a WHEN, or nothing ever asks it.' });
        continue;
      }
      if(!KEY_IDS.includes(b.key))
        errs.push({ code:'bad-key', blockId:b.id,
          msg:'"'+b.key+'" is not a key this robot watches.' });
      /* TWO RULES ON ONE KEY IS NOT AN ERROR — the first one wins, which
         is a rule they already know — but it is nearly always a mistake,
         and one worth saying out loud rather than leaving them to wonder
         why the second one never runs. */
      if(used.has(b.key))
        errs.push({ code:'duplicate-key', blockId:b.id, warn:true,
          msg:keyLabel(b.key)+' already has a rule above this one, and the first one wins.' });
      used.add(b.key);

      const body=b.body||[];
      if(!body.length)
        errs.push({ code:'empty-rule', blockId:b.id, warn:true,
          msg:keyLabel(b.key)+' is set up to do nothing yet.' });
      for(const a of body){
        if(!a || !ACTIONS[a.type])
          errs.push({ code:'unknown', blockId:a&&a.id,
            msg:'"'+(a&&a.type)+'" is not a block.' });
        else if(!allow.has(a.type))
          errs.push({ code:'not-allowed', blockId:a.id,
            msg:'"'+ACTIONS[a.type].label+'" is not something this robot can do yet.' });
      }
    }
    /* A warning is not a refusal. `ok` ignores them, so a program with a
       shadowed key still runs: it is legal, it is just probably not what
       they meant. */
    return { ok:!errs.some(e=>!e.warn), errors:errs, blocks:n };
  }

  /* --------------------------------------------------------- the read
     `held` is the keys down this instant — a Set, or any object that
     answers to the key code. Rules are read top to bottom and the FIRST
     one whose key is held wins.

     A rule that fired with nothing under it says so rather than falling
     quietly through to the next one, because a rule that matched and did
     nothing is the exact thing a student cannot see. */
  function decide(program, held){
    const has = k => !!(held && (held.has ? held.has(k) : held[k]));
    const trace=[];
    for(const rule of (program||[])){
      if(!rule || rule.type!=='when') continue;
      if(!KEY_IDS.includes(rule.key)) continue;
      if(!has(rule.key)) continue;
      trace.push({ kind:'key', key:rule.key, blockId:rule.id });
      for(const a of (rule.body||[])){
        if(!a || !ACTIONS[a.type]) continue;
        trace.push({ kind:'action', act:a.type, blockId:a.id });
        return { action:{ act:a.type, blockId:a.id }, trace };
      }
      /* IT MATCHED, SO IT WINS — even though it does nothing. Falling
         through to the next rule on the same key would make the language
         "the first NON-EMPTY rule wins", which is a subtler rule than
         the one the screen teaches and one nobody could guess. An empty
         rule takes its turn and wastes it, and the feed says exactly
         that, which is how a student finds out it is there. */
      trace.push({ kind:'stall', why:keyLabel(rule.key)+' has nothing to do.' });
      return { action:null, trace };
    }
    return { action:null, trace };
  }

  /* ------------------------------------------------------ readability
     The trace, said out loud, in the words the blocks are written in. */
  function say(step){
    if(step.kind==='key')    return 'WHEN '+keyLabel(step.key)+' IS PRESSED';
    if(step.kind==='action') return (ACTIONS[step.act]||{label:step.act}).label;
    if(step.kind==='stall')  return step.why;
    return '';
  }

  const API={ KEYS, KEY_IDS, keyById, keyLabel,
              ACTIONS, ACTION_IDS,
              countBlocks, validate, decide, say };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.MECHACODE=API;
})(typeof self!=='undefined' ? self : this);
