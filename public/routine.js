/* =====================================================================
   ION'S MORNING ROUTINE — the program, and what happens when it runs.

   It lives on its own for the same reason logic.js does: a lesson about
   loops is only worth anything if the thing a student changes in the
   console is the thing the robot on the floor actually obeys. One
   interpreter, no DOM in it, called by the console and tested under Node.

   THE PROGRAM IS NOT MARKED AGAINST AN ANSWER KEY. There is no list of
   correct values in here, and that is deliberate: `repeat 4 [move 10]`
   and `repeat 5 [move 8]` both walk forty steps and both are right, and a
   checker that only accepted the first would be teaching a student to
   guess what the teacher wrote down rather than to make the program work.
   run() walks the program and reports what Ion DID. Whether that counts
   is one line at the bottom, and it is about the breakfast.

   THREE HOLES, one per idea:

     stride   MOTION   move ( ? ) steps
     loop     LOOPS    ( forever | repeat ( ? ) )
     test     IF       if < he ( is | is not ) in the kitchen >

   The faults it starts in are the symptom the player walked in on: a
   forever loop is why Ion is lying there repeating the same half-sentence
   and never reaching the line after it.
   ===================================================================== */
(function(root){
  /* How far the kitchen is, in Ion's own steps. Forty rather than four so
     the stride is a number worth choosing. */
  const KITCHEN = 40;
  /* AND WHY THE LOOP CANNOT BE DODGED. Without a cap, `repeat 1 [move
     40]` walks him there in one hop and the lesson about loops is a
     lesson the student never has to attend. His motors are the reason,
     and it is a reason the console says out loud rather than a rule it
     enforces silently. */
  const STRIDE_MAX = 10;
  const REPEAT_MAX = 12;

  /* What the console finds when it opens him up. */
  const broken = () => ({ stride:0, loop:'forever', times:1, test:'is not' });

  const clamp=(n,lo,hi)=>Math.max(lo, Math.min(hi, Math.round(+n||0)));
  function tidy(s){
    s=s||{};
    return { stride: clamp(s.stride, 0, STRIDE_MAX),
             loop:   s.loop==='repeat' ? 'repeat' : 'forever',
             times:  clamp(s.times, 0, REPEAT_MAX),
             test:   s.test==='is' ? 'is' : 'is not' };
  }

  /* --------------------------------------------------------------- run
     Returns what happened, as a list of lines somebody can read, plus the
     three facts the console needs: did he get there, did the `if` fire,
     and is that breakfast. */
  function run(state){
    const s=tidy(state);
    const trace=[];
    const step=(text, kind)=>trace.push({ text, kind:kind||'do' });

    step('when ▶ clicked', 'hat');

    let dist=0, stuck=false;
    if(s.loop==='forever'){
      /* A forever loop is not a bug in itself — it is the right block for
         a thing that should never stop. It is a bug HERE because there is
         a line after it, and nothing after a forever loop ever runs. That
         is the whole lesson and it is worth saying in the trace rather
         than in a hint box. */
      stuck=true;
      step('repeat for ever:', 'loop');
      step(s.stride ? `walks ${s.stride} steps… and again… and again…`
                    : 'tries to walk 0 steps… and again… and again…', 'in');
      step('nothing after this ever runs.', 'bad');
      return { trace, dist:null, reached:false, fired:false, ok:false, stuck,
               why:'He never comes out of the loop, so he never gets to the next line.' };
    }

    step(`repeat ${s.times} times:`, 'loop');
    if(s.times===0) step('…which is no times at all. He does not move.', 'in');
    for(let i=0;i<s.times;i++){ dist+=s.stride; step(`walks ${s.stride} steps (${dist} so far)`, 'in'); }

    const reached = dist >= KITCHEN;
    step(reached ? `He is in the kitchen. (${dist} of ${KITCHEN})`
                 : `He stops ${KITCHEN-dist} steps short of the kitchen. (${dist} of ${KITCHEN})`,
         reached ? 'good' : 'bad');

    const fired = s.test==='is' ? reached : !reached;
    step(`if he ${s.test} in the kitchen — ${fired ? 'YES' : 'no'}`, 'if');
    if(fired) step('makes breakfast.', reached ? 'good' : 'bad');
    else      step('says: my legs will not…', 'bad');

    const ok = reached && fired;
    return { trace, dist, reached, fired, ok, stuck, why: ok ? null : why(s, reached, fired) };
  }

  /* WHAT TO SAY WHEN IT DID NOT WORK — about the program, never about the
     answer. "Try 4" teaches nothing; "he stopped short" sends them back to
     the two numbers that decide how far he goes. */
  function why(s, reached, fired){
    if(!reached && s.stride===0)
      return 'His stride is 0, so every trip round the loop moves him nowhere.';
    if(!reached && s.times===0)
      return 'The loop runs 0 times, so the walking never happens at all.';
    if(!reached)
      return `${s.times} × ${s.stride} is ${s.times*s.stride}, and the kitchen is ${KITCHEN} steps away.`;
    if(!fired)
      return 'He got to the kitchen, and then the `if` asked the wrong question about it.';
    return 'He made breakfast somewhere that is not the kitchen.';
  }

  /* ================================================== THE WALKTHROUGH
     THREE FAULTS IS THREE TOO MANY TO BE HANDED AT ONCE. A student who
     opens this and sees a whole program with no idea which part of it is
     the problem is not debugging, they are guessing — so the console is
     WALKED, one fault at a time, with the block it is about ringed on the
     screen. It is the same discipline the first mission uses: every step
     names what it wants and how it knows it happened, and a student who
     works the next one out on their own is never told to do the thing
     they have already done.

     IT READS THE PROGRAM, NOT A COUNTER. `at` is whichever step is still
     unsatisfied, so fixing them out of order works, and undoing a fix
     brings its step back rather than stranding somebody past it. That is
     the difference between a walkthrough and a slideshow.

     None of these say what to TYPE. "Change forever to repeat" names a
     block; "put 4 in it" would be the answer, and the arithmetic is the
     part worth doing. */
  const STEPS = [
    { id:'loop', hole:'loop',
      bad: s => s.loop!=='repeat',
      say: 'This loop never ends, so nothing after it ever runs \u2014 which is '
         + 'why he is stuck saying half a sentence. A <b>forever</b> loop is the '
         + 'wrong loop when something has to happen afterwards. Change it to '
         + '<b>repeat</b>.' },
    { id:'far', hole: s => s.stride===0 ? 'stride' : 'times',
      bad: s => s.times * s.stride < KITCHEN,
      say: s => 'Now count. The kitchen is <b>' + KITCHEN + '</b> steps away and his '
         + 'motors will not take a stride longer than <b>' + STRIDE_MAX + '</b>. '
         + 'Right now the loop walks him ' + s.times + ' \u00d7 ' + s.stride
         + ' = <b>' + (s.times*s.stride) + '</b>.' },
    { id:'test', hole:'test',
      bad: s => s.test!=='is',
      say: 'He gets there now \u2014 and then makes breakfast in the hallway. Read '
         + 'the <b>if</b> out loud: it fires when he is <b>not</b> in the kitchen. '
         + 'That is backwards.' }
  ];
  /* The step the console is on, or null when the program is right. */
  function step(state){
    const s=tidy(state);
    for(const st of STEPS){
      if(!st.bad(s)) continue;
      return { id:st.id,
               hole: typeof st.hole==='function' ? st.hole(s) : st.hole,
               say:  typeof st.say==='function'  ? st.say(s)  : st.say,
               n: STEPS.indexOf(st)+1, of: STEPS.length };
    }
    return null;
  }

  const API = { KITCHEN, STRIDE_MAX, REPEAT_MAX, broken, tidy, run, STEPS, step };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROUTINE=API;
})(typeof self!=='undefined' ? self : this);
