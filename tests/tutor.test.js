/* =====================================================================
   THE TUTOR, under test.

   Two halves, and the second one is the point.

   THE INTEGRATION: does it call Claude the way it means to — the right
   model, the expensive half of the prompt cached, and the student's own
   work AFTER the cache breakpoint rather than in front of it, where it
   would bust the cache on every single question in the school.

   THE PEDAGOGY: the whole reason this exists is that it must NOT write
   the program. That rule lives in a prompt, which is to say in prose,
   which is to say it can be edited away by accident in a hurry. These
   pin down the sentences that carry it — not the phrasing, but that the
   instruction is there at all, and that the things it must not get wrong
   about this game (the twitch, the missing PUNCH block, who owns health)
   are in front of the model.

   Nothing here calls the API. There is no key in a test runner and a
   test that spends money on every commit is a test somebody disables.
   The SDK is stubbed, and what is checked is the request that WOULD go.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const P = f => path.join(__dirname,'..',f);
const read = f => fs.readFileSync(P(f),'utf8');

/* ---------------------------------------------------- the stub
   Put in front of the real SDK before server/tutor.js is loaded, so it
   picks this up instead. Records what it was asked for. */
let SENT=null, REPLY=null;
function install(){
  const id=require.resolve('@anthropic-ai/sdk');
  class Fake {
    constructor(){ this.messages={ stream:(params)=>{
      SENT=params;
      const events=(REPLY||{}).events||[];
      const final=(REPLY||{}).final||{ stop_reason:'end_turn', usage:{} };
      return { [Symbol.asyncIterator](){ let i=0;
                 return { next: async()=> i<events.length
                    ? { value:events[i++], done:false } : { value:undefined, done:true } }; },
               finalMessage: async()=>final };
    } }; }
  }
  require.cache[id]={ id, filename:id, loaded:true, exports:Fake };
}
install();
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';
const tutor = require('../server/tutor.js');

const say = t => ({ type:'content_block_delta', delta:{ type:'text_delta', text:t } });
async function ask(question, context, history){
  const out=[];
  await tutor.ask({ question, context, history }, s=>out.push(s));
  return out.join('');
}

/* ==================================================================== */
test('it streams the answer through rather than waiting for the whole thing', async ()=>{
  REPLY={ events:[ say('Look at '), say('where your '), say('if is sitting.') ] };
  assert.strictEqual(await ask('why does it only move once?', {}),
    'Look at where your if is sitting.');
});

test('it asks Claude Opus 5, and says how hard to think', async ()=>{
  REPLY={ events:[say('hi')] };
  await ask('what does forever do?', {});
  assert.strictEqual(SENT.model, 'claude-opus-5');
  assert.deepStrictEqual(SENT.thinking, { type:'adaptive' });
  assert.ok(SENT.output_config && SENT.output_config.effort,
    'no effort is set, so every question in the school runs at the default');
  assert.ok(SENT.max_tokens > 0 && SENT.max_tokens <= 4000,
    'a hint should not be able to run to an essay');
});

test('the big half of the prompt is cached, and the changing half is not in front of it', async ()=>{
  /* Every child in the school sends the same pedagogy and the same block
     reference. That is the prefix; it is worth caching once. The script
     they are staring at changes with every question — in front of the
     breakpoint it would invalidate the cache on every single ask. */
  REPLY={ events:[say('hi')] };
  await ask('help', { script:'when flag\n  forever' });
  assert.ok(Array.isArray(SENT.system), 'the system prompt is not a block list, so it cannot carry cache_control');
  assert.ok(SENT.system.some(b=>b.cache_control && b.cache_control.type==='ephemeral'),
    'nothing in the system prompt is cached');
  const sys=SENT.system.map(b=>b.text).join('\n');
  assert.ok(sys.indexOf('when flag')<0,
    'the student\'s script is inside the cached prefix, so their next question pays for the whole prompt again');
  const msg=SENT.messages[SENT.messages.length-1].content;
  assert.ok(msg.indexOf('when flag')>=0, 'the tutor is never shown the script');
});

test('it is told what the student can see', async ()=>{
  REPLY={ events:[say('hi')] };
  await ask('what now?', {
    stage:'1 — MAKE IT MOVE', step:'Click the gap inside the loop.',
    goal:'Drive your robot with two keys.', world:'an empty ring',
    palette:['forever','if %c then'], script:'when ▶ the game starts' });
  const msg=SENT.messages[SENT.messages.length-1].content;
  ['MAKE IT MOVE','Click the gap inside the loop.','Drive your robot',
   'empty ring','forever','when ▶ the game starts'].forEach(bit=>
    assert.ok(msg.indexOf(bit)>=0, 'the tutor is not told: '+bit));
});

test('an empty script says so, rather than looking like a missing field', async ()=>{
  REPLY={ events:[say('hi')] };
  await ask('how do I start?', { script:'' });
  assert.match(SENT.messages[SENT.messages.length-1].content, /empty/i);
});

test('nothing a student sends can make the request enormous', async ()=>{
  REPLY={ events:[say('hi')] };
  const huge='x'.repeat(50000);
  await ask(huge, { script:huge, step:huge, palette:[huge] },
            Array.from({length:200},(_,i)=>({ role:'user', text:'q'+i })));
  const msg=SENT.messages[SENT.messages.length-1].content;
  assert.ok(msg.length < 6000, 'one question can send '+msg.length+' characters');
  assert.ok(SENT.messages.length <= tutor.MAX_TURNS+1,
    'the whole conversation is resent, however long it has got');
});

test('a refusal says something, instead of an empty bubble', async ()=>{
  REPLY={ events:[], final:{ stop_reason:'refusal', usage:{} } };
  const out=await ask('something off-topic', {});
  assert.ok(out.trim().length>0, 'a refused question leaves the student looking at nothing');
});

/* ------------------------------------------------------- the pedagogy
   Matched against the prose with its line wrapping collapsed. Where a
   sentence happens to break is not a fact about the instruction, and a
   test that fails when somebody rewraps a paragraph is a test that gets
   deleted rather than fixed. */
const flat = s => String(s).replace(/\s+/g,' ');

test('the tutor is told, in terms, not to write the program', ()=>{
  const how=flat(tutor.HOW);
  assert.match(how, /[Nn]ever write their program/,
    'the one rule this whole feature exists for is not in the prompt');
  assert.match(how, /not even when they ask you directly/i,
    'nothing tells it to hold the line when a child simply asks for the answer');
  /* and it must not read as "be unhelpful", which is the other failure */
  assert.match(how, /not the same as being vague/i,
    'nothing stops it answering in fog, which is worse than answering plainly');
  assert.match(how, /[Nn]ame the block/,
    'it is not told it may name the block, so it will hedge about everything');
});

test('the tutor knows the things about this game it would otherwise guess wrong', ()=>{
  const how=flat(tutor.HOW);
  assert.match(how, /checked ONCE/,
    'it does not know the commonest mistake in the game');
  assert.match(how, /no PUNCH block/i,
    'it does not know there is no punch block, so it will recommend one');
  assert.match(how, /referee owns health and stamina/i,
    'it does not know a script cannot set health, so it will tell a child to');
  assert.match(how, /x runs across/i, 'it does not know which way the axes go');
  assert.match(how, /[Nn]othing is saved/,
    'it does not know a mission is a fresh room, so it will not say "just try it"');
});

test('it is talking to a child, and is told so', ()=>{
  assert.match(flat(tutor.HOW), /child/i, 'nothing in the prompt says who it is talking to');
  assert.match(flat(tutor.HOW), /teacher/i, 'it is not told to hand anything off to a teacher');
  assert.match(flat(tutor.HOW), /[Nn]ever ask for a name|age|school/,
    'nothing stops it asking a child for personal details');
});

/* --------------------------------------------------- the block reference */
test('the tutor is handed every block there is, generated and not typed', ()=>{
  /* A second hand-written copy of the language is a copy that goes stale
     the first time a block is added, and a tutor recommending a block
     that is not on the palette is worse than one that says nothing. */
  const ctx=require('node:vm').createContext({ console });
  ctx.window=ctx; ctx.self=ctx;
  require('node:vm').runInContext(read('public/blocks.js'), ctx, { filename:'blocks.js' });
  const lang=tutor.language();
  ctx.BLOCKS.LIST.forEach(bd=>{
    assert.ok(lang.indexOf(bd.op)>=0, 'the tutor has never heard of '+bd.op);
    assert.ok(lang.indexOf(bd.label)>=0, 'the tutor does not know what '+bd.op+' reads as');
  });
  ctx.BLOCKS.LIST.forEach(bd=>{
    const help=ctx.BLOCKS.help(bd.op);
    if(help) assert.ok(lang.indexOf(help)>=0, 'the tutor is not told what '+bd.op+' is for');
  });
  assert.match(lang, /THE THREE AXES/, 'the axes are not in the reference');
  assert.ok(!/require\(|fs\./.test(tutor.HOW), 'the pedagogy leaked code');
});

/* ------------------------------------------------------------ the route */
test('the endpoint is signed-in only, rate limited, and silent without a key', ()=>{
  const src=read('server/index.js');
  const route=src.slice(src.indexOf("app.post('/api/tutor'"), src.indexOf("const PORT"));
  assert.match(route, /auth\.fromReq\(req\)/, 'anybody can spend the key');
  assert.match(route, /401/, 'a signed-out request is not turned away');
  assert.match(route, /tutor\.on\(\)/, 'it tries to answer with no key configured');
  assert.match(route, /COOLDOWN/, 'one child can hold the button down');
  assert.match(route, /text\/event-stream/, 'the answer is not streamed');
  /* and nothing is written down */
  assert.ok(!/INSERT|UPDATE .*tutor|db\.q/.test(route),
    'the tutor route touches the database — the conversation is meant to be forgotten');
});

test('no key on the server means no button', ()=>{
  assert.match(read('server/index.js'), /\/api\/tutor\/on/,
    'the page cannot find out whether there is a tutor');
  const ask=read('public/ask.js');
  assert.match(ask, /tutor\/on/, 'the panel never asks whether it should exist');
  assert.match(ask, /classList\.toggle\('hidden', !live\)/,
    'the button is shown whether or not the tutor is configured');
});

test('what a child typed is never treated as markup', ()=>{
  const ask=read('public/ask.js');
  assert.match(ask, /d\.textContent=text/,
    'the chat renders with innerHTML, so a question containing a tag becomes one');
  assert.ok(!/log\.innerHTML\s*\+=/.test(ask), 'the log is built by string concatenation');
});

test('the script is sent in the words the child sees, not in op names', ()=>{
  /* `ctrl.if` and `sense.key` are names no child has ever seen. A tutor
     told those will answer in them. */
  const ask=read('public/ask.js');
  assert.match(ask, /BLOCKS\.parts\(bd\.label\)/,
    'the script is written out from op names rather than from the block labels');
  assert.match(ask, /'  '\.repeat\(depth\)/,
    'the nesting is flattened, which is the half of a Scratch program that matters most');
});
