/* =====================================================================
   TUTOR — somebody to ask, who will not do it for you.

   A student stuck on a block has two bad options: guess, or ask the
   teacher and wait while twenty-nine other people also wait. This is the
   third one. It answers questions about the blocks, looks at what they
   have actually written, and helps them get unstuck.

   WHAT MAKES IT DIFFERENT FROM A CHATBOT THAT WRITES THE PROGRAM. The
   whole value of this mode is the ten seconds before the penny drops. An
   assistant that hands over the finished script buys a working robot at
   the price of the lesson, and it is a bad trade — the student ends up
   with a program they cannot change, because they never knew why it was
   that shape.

   So the rule is not "be vague". Vague help is just slow help, and it is
   worse than useless to somebody who is genuinely lost. The rule is that
   the LAST STEP IS ALWAYS THEIRS: it names the block, says what the
   block is for, points at the exact place in their own script where the
   problem is — and stops short of putting it there. A student who
   follows a good hint has still done the thing.

   IT CAN SEE THEIR WORK, which is what makes the hints worth anything. A
   tutor that cannot read the script can only recite the manual; this one
   is told what blocks exist, which ones the student has been handed,
   what they have built so far, which mission they are on and which step
   of the walkthrough they are stuck on. "Your `if` is under the loop
   rather than inside it" is only sayable by something that can see it.

   NOTHING IS STORED. The conversation lives in the browser tab and dies
   with it, the same as the room's chat and for the same reason.

   No key configured means no tutor, and the button never appears — this
   has to be deployable by a school that does not want it, or cannot pay
   for it, without editing anything.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch(e){ /* not installed */ }

/* SONNET, ASKED FOR. This is a chat box answering "what does this block
   do" and "why will my robot not move", against a system prompt that
   already spells out how to answer them — the judgement lives mostly in
   the prompt rather than in the model. It is also around two and a half
   times cheaper per token than the Opus tier, which for a lab full of
   children asking all lesson is the difference that decides whether the
   thing stays switched on. */
const MODEL = 'claude-sonnet-5';
/* A LAB FULL OF PEOPLE WAITING. Short questions, short answers, and a
   class of thirty who care about the reply arriving before they have
   given up on it. Raise this if the hints start reading generic. */
const EFFORT = 'low';
const MAX_TOKENS = 1400;          // a hint, not an essay
const MAX_ASK = 600;              // one question from one child
const MAX_TURNS = 12;             // and a short memory

const on = () => !!(Anthropic && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN));
let client = null;
const anthropic = () => (client = client || new Anthropic());

/* ------------------------------------------------------- the language
   READ OUT OF blocks.js, NEVER TYPED HERE. The tutor has to know exactly
   which blocks exist, what they are called and what each one is for, and
   a second hand-written copy of that list is a copy that goes stale the
   first time a block is added — leaving the tutor recommending a block
   that is not on the palette, which is the most confusing thing it could
   possibly do.

   blocks.js is a browser global, so it is read as source and run in a
   scratch context, the same way the tests do it. */
function language(){
  const src = fs.readFileSync(path.join(__dirname,'..','public','blocks.js'),'utf8');
  const ctx = vm.createContext({ console });
  ctx.window = ctx; ctx.self = ctx;
  vm.runInContext(src, ctx, { filename:'blocks.js' });
  const B = ctx.BLOCKS;
  const shape = { hat:'starts a script', stack:'does something', c:'wraps blocks',
                  c2:'wraps two lots of blocks', cap:'ends a script',
                  report:'gives a number or word', bool:'gives yes or no' };
  const lines = B.CATS.map(cat => {
    const rows = B.inCat(cat.id).map(bd =>
      `  ${bd.label}\n      [${bd.op}] ${shape[bd.kind]||bd.kind} — ${B.help(bd.op)}`);
    return `${cat.name}\n${rows.join('\n')}`;
  });
  const axes = B.AXES.map(a=>`  ${a.v} — ${a.say} (from overhead: ${a.flat})`).join('\n');
  return `THE WHOLE LANGUAGE. These are all the blocks there are.\n\n`+
         lines.join('\n\n')+
         `\n\nTHE THREE AXES\n${axes}\n`+
         `The keys a key-block can watch: ${B.KEYS.map(k=>k.name).join(', ')}.`;
}
let LANG = null;
const languageOnce = () => (LANG = LANG || language());

/* ------------------------------------------------------ the pedagogy */
const HOW = `You are the tutor inside KORO, a game where children aged about
9 to 14 learn to program by building robots out of Scratch-like blocks.
You are talking to one of those children.

WHAT YOU ARE FOR
Getting them unstuck, and leaving them able to get themselves unstuck next
time. They can see their blocks; you can see their blocks; talk about the
ones that are actually on their screen.

THE ONE RULE THAT MATTERS
Never write their program for them. Not as a list of blocks to place in
order, not as "just put X inside Y and set it to 3", not even when they
ask you directly, and not on the fifth time of asking. The ten seconds
before they work it out is the entire value of this game. An answer that
skips it buys them a working robot and costs them the lesson.

THIS IS NOT THE SAME AS BEING VAGUE. Vague help is slow help and it is
miserable to be on the end of. Be specific about everything except the
last step:
  · Name the block. "You want \`if\`" is fine.
  · Say what a block is for, in one sentence, whenever asked.
  · Point at the exact place in THEIR script. "Look at where your \`if\` is
    sitting" is the good version of "check your code".
  · Tell them what to LOOK at to find out: "press Run and watch its feet",
    "what number is in the say bubble when you are next to him?"
Then stop. The placing, the typing and the number are theirs.

HOW TO ANSWER
Two or three sentences. This is a chat box next to a game, not a manual.
Lead with the useful thing; do not open with "Great question!".
One idea at a time — if they need three blocks, talk about the first.
End with something they can go and do, or a question that makes them look
at their own program.

WHEN THEY ARE REALLY STUCK
If they have asked the same thing three times, get narrower, not vaguer.
Name the block, name the slot it goes in, and name the block it goes
inside. Let them do the click. That is still them.

WHEN THEY ASK FOR A NUMBER
Never say it. "How far should I move?" → tell them what the number means
and how to see whether it is too big: the floor is a grid, one square is
one unit, and the loop runs sixty times a second.

WHEN THEY ARE WRONG ABOUT WHAT THEIR PROGRAM DOES
Do not correct them with the answer. Ask what they expected and what
happened instead. The gap between those two is where the lesson is.

THINGS THAT ARE TRUE HERE AND NOWHERE ELSE, so do not guess:
  · A conditional on its own is checked ONCE, on the frame Run was
    pressed. Inside a forever loop it is asked over and over. This is the
    single commonest mistake in the whole game and the reason the first
    mission exists.
  · There is no PUNCH block and there never will be. An attack is
    \`set [light] to 1\`: the program ASKS, and the referee decides whether
    it happened, charges the stamina and works out whether it reached.
  · The referee owns health and stamina. A script can read them and can
    never set them.
  · x runs across the screen, y goes into it and back out, z is up.
  · Nothing is saved. Every entry into a mission is a fresh room, so
    "try it and see" is free and is usually the right advice.

SAFETY
You are talking to a child. Stay on the game and the programming in it.
If they raise something upsetting or unrelated, say kindly that you are
just the blocks tutor and that a teacher is the person to talk to.
Never ask for a name, an age, a school, or anything else about them.`;

/* --------------------------------------------------- what they can see
   The student's own half of the context. Capped hard: this is on every
   request and a project with two hundred blocks in it would otherwise
   push the cached prefix out of the way for nothing. */
function board(ctx){
  ctx = ctx || {};
  const cap = (s,n) => String(s==null?'':s).slice(0,n);
  const bits = [];
  if(ctx.stage)  bits.push(`MISSION: ${cap(ctx.stage,80)}`);
  if(ctx.step)   bits.push(`THE STEP THEY ARE ON: ${cap(ctx.step,300)}`);
  if(ctx.goal)   bits.push(`WHAT THE MISSION WANTS: ${cap(ctx.goal,200)}`);
  if(ctx.palette && ctx.palette.length)
    bits.push(`BLOCKS THEY HAVE RIGHT NOW: ${cap(ctx.palette.join(', '), 600)}`);
  bits.push(ctx.script && String(ctx.script).trim()
    ? `THEIR SCRIPT, AS IT IS ON SCREEN:\n${cap(ctx.script, 2600)}`
    : `THEIR SCRIPT: empty — they have not placed a block yet.`);
  if(ctx.world) bits.push(`THE ROOM: ${cap(ctx.world, 300)}`);
  return bits.join('\n\n');
}

/* ------------------------------------------------------------- asking
   Streamed, because a reply that appears a word at a time is a reply a
   child will wait for and a reply that appears all at once after four
   seconds is one they have already clicked away from.

   The system prompt is the big, identical half of every request in the
   whole school — the pedagogy and the entire block reference — so it is
   cached. What the student can see goes AFTER the breakpoint, because it
   changes on every single question.

   That prefix is about three and a half thousand tokens, which clears
   Sonnet's thousand-token minimum comfortably. The minimum is PER MODEL
   and is not monotonic across generations, so swapping to a model with a
   higher floor would stop the caching SILENTLY — no error, just
   cache_creation_input_tokens sitting at zero and a bill that has
   quietly gone up. If this ever looks expensive, check that number
   first. */
async function ask({ question, history, context }, out){
  if(!on()) throw new Error('no tutor configured');
  const msgs = [];
  (history||[]).slice(-MAX_TURNS).forEach(m=>{
    const role = m.role==='assistant' ? 'assistant' : 'user';
    const text = String(m.text||'').slice(0, MAX_ASK*2);
    if(text) msgs.push({ role, content:text });
  });
  msgs.push({ role:'user', content:
    `${board(context)}\n\nWHAT THEY ASKED:\n${String(question||'').slice(0, MAX_ASK)}` });

  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type:'adaptive' },
    output_config: { effort: EFFORT },
    system: [
      { type:'text', text: HOW + '\n\n' + languageOnce(),
        cache_control:{ type:'ephemeral' } }
    ],
    messages: msgs
  });

  for await (const ev of stream){
    if(ev.type==='content_block_delta' && ev.delta && ev.delta.type==='text_delta')
      out(ev.delta.text);
  }
  const done = await stream.finalMessage();
  /* A refusal arrives as a 200 with nothing in it, which would look like
     the tutor simply failing. Say something rather than nothing. */
  if(done.stop_reason === 'refusal')
    out('\n\nI am not able to answer that one — ask your teacher.');
  return done.usage;
}

module.exports = { on, ask, HOW, board, language, MODEL, EFFORT, MAX_ASK, MAX_TURNS };
