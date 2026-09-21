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

test('it asks Claude Sonnet 5, and says how hard to think', async ()=>{
  REPLY={ events:[say('hi')] };
  await ask('what does forever do?', {});
  assert.strictEqual(SENT.model, 'claude-sonnet-5');
  assert.deepStrictEqual(SENT.thinking, { type:'adaptive' });
  assert.ok(SENT.output_config && SENT.output_config.effort,
    'no effort is set, so every question in the school runs at the default');
  assert.ok(SENT.max_tokens > 0 && SENT.max_tokens <= 4000,
    'a hint should not be able to run to an essay');
});

test('the cached prefix is long enough for this model to actually cache it', ()=>{
  /* THE MINIMUM IS PER MODEL AND NOT MONOTONIC across generations — 512
     tokens on Opus 5, 1024 on Sonnet 5, 4096 on Opus 4.6 and Haiku 4.5.
     Under it, caching fails SILENTLY: no error, just
     cache_creation_input_tokens sitting at zero and a bill that has
     quietly gone up. Checked here so a model swap cannot do that
     unnoticed. */
  const MINIMUM={ 'claude-sonnet-5':1024, 'claude-opus-5':512,
                  'claude-opus-4-8':1024, 'claude-haiku-4-5':4096 };
  const floor=MINIMUM[tutor.MODEL];
  assert.ok(floor!==undefined,
    tutor.MODEL+' is not in this table — look up its minimum cacheable prefix before shipping it');
  const chars=(tutor.HOW+'\n\n'+tutor.language()).length;
  const tokens=chars/3.5;                    // deliberately pessimistic
  assert.ok(tokens > floor*1.3,
    'the cached prefix is about '+Math.round(tokens)+' tokens and '+tutor.MODEL+
    ' will not cache anything under '+floor+' — every question would pay for the whole prompt');
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
  assert.match(ask, /BAR\.repeat\(depth\)/,
    'the nesting is flattened, which is the half of a Scratch program that matters most');
});

/* ================================================ blocks, as blocks
   The tutor writes a block as {{ctrl.if}} and the panel draws the real
   thing — same label, same slots, same colour as the palette. A child
   matching a picture to the palette beats a child matching a word.

   `drawn` needs a DOM and this suite has none, so it is lifted out of
   ask.js and run against the four DOM calls it actually makes. That is
   the real function, not a copy of it. */
function renderer(){
  const src=read('public/ask.js');
  const cut=name=>{
    const i=src.indexOf('  const MARK=');
    const j=src.indexOf('  /* Nodes, never innerHTML');
    assert.ok(i>0 && j>i, 'ask.js no longer has a block renderer where this can find it');
    return src.slice(i,j);
  };
  /* the smallest DOM these functions touch */
  const node = tag => ({ tag, className:'', title:'', kids:[], style:{ setProperty(){} },
    appendChild(c){ this.kids.push(c); return c; },
    get textContent(){ return this.kids.map(k=>k.text!==undefined?k.text:k.textContent).join(''); },
    set textContent(v){ this.kids=[{ text:String(v) }]; } });
  const ctx={
    document:{ createElement:node, createTextNode:t=>({ text:String(t) }) },
    window:{}, assert
  };
  const blocksCtx=require('node:vm').createContext({ console });
  blocksCtx.window=blocksCtx; blocksCtx.self=blocksCtx;
  require('node:vm').runInContext(read('public/blocks.js'), blocksCtx, { filename:'blocks.js' });
  ctx.window.BLOCKS=ctx.BLOCKS=blocksCtx.BLOCKS;
  const fn=new Function('document','window','BLOCKS', cut()+'\nreturn { chip, drawn, MARK };');
  return { ...fn(ctx.document, ctx.window, ctx.BLOCKS), node };
}

test('the tutor is told to name blocks in the shape the panel can draw', ()=>{
  const how=flat(tutor.HOW);
  assert.match(how, /\{\{op\}\}/, 'nothing tells it how to name a block');
  assert.match(how, /\{\{ctrl\.if\}\}|\{\{ctrl\.forever\}\}/, 'it is given no example of the shape');
  /* and it must not use them to write the program in pictures instead */
  assert.match(how, /ONE BLOCK PER MARKER, AND NEVER A STACK/i,
    'nothing stops it writing the whole script as a run of block pictures');
});

test('a named block is drawn as that block, off the same table the palette uses', ()=>{
  const { chip } = renderer();
  const el=chip('ctrl.if');
  assert.ok(el, 'ctrl.if did not draw');
  assert.strictEqual(el.textContent.replace(/\s+/g,' ').trim(), 'if ◇ then',
    'the block does not read the way it reads on the palette');
  assert.match(el.className, /\bcblk\b/, 'it is not wearing the palette block class');
  assert.match(el.className, /k-c\b/,    'it is not the right shape for a C block');
  assert.ok(el.title.length>0, 'no help text, so hovering it says nothing');
  assert.strictEqual(chip('motion.changeBy').textContent.replace(/\s+/g,' ').trim(),
    'change [x] by [0.2]'.replace(/[\[\]]/g,''), 'a block with slots lost its defaults');
});

test('a marker naming something that is not a block is left as it arrived', ()=>{
  /* Showing what was actually said beats silently swallowing it. */
  const { drawn, node } = renderer();
  const out=node('div');
  drawn('try {{ctrl.nonsense}} and {{not.ablock}}', out);
  assert.match(out.textContent, /\{\{ctrl\.nonsense\}\}/);
  assert.match(out.textContent, /\{\{not\.ablock\}\}/);
});

test('the prose round a block survives, and nothing is dropped', ()=>{
  const { drawn, node } = renderer();
  const out=node('div');
  drawn('Look at your {{ctrl.if}} — is it inside the {{ctrl.forever}}?', out);
  const text=out.textContent.replace(/\s+/g,' ');
  assert.match(text, /^Look at your /,  'the words before the first block were lost');
  assert.match(text, /is it inside the/, 'the words between two blocks were lost');
  assert.match(text, /\?$/,              'the words after the last block were lost');
  assert.ok(text.indexOf('{{')<0, 'a marker leaked through as braces');
  const blocks=out.kids.filter(k=>k.className && /cblk/.test(k.className));
  assert.strictEqual(blocks.length, 2, 'expected two blocks, got '+blocks.length);
});

test('a marker split across two stream chunks never shows as half a brace', ()=>{
  /* The stream arrives in pieces and a marker is routinely cut in two.
     The panel redraws from the WHOLE text each repaint rather than
     appending, which is what makes this safe — appending would paint
     "{{ctrl" and then have to take it back. */
  const { drawn, node } = renderer();
  const whole='Your {{ctrl.if}} is loose.';
  for(let cut=1; cut<whole.length; cut++){
    const out=node('div');
    drawn(whole.slice(0,cut), out);            // every prefix must be safe to show
    const t=out.textContent;
    assert.ok(!/\{\{[a-z.]*\}\}/.test(t),
      'a complete marker survived unrendered at cut '+cut+': '+t);
  }
  assert.match(read('public/ask.js'), /row\.textContent='';\s*\n\s*drawn\(mine\.text, row\)/,
    'the stream is appended to rather than redrawn, so half a marker would be painted');
});

test('the answer is still built as nodes, never as markup', ()=>{
  /* Checked against the CODE, with the comments stripped — the comment
     above it says "never innerHTML", and a test that reads prose would
     fail on the sentence promising the thing it is checking for. */
  const ask=read('public/ask.js');
  const i=ask.indexOf('function drawn('), j=ask.indexOf('function bubble(');
  const body=ask.slice(i, j>i?j:undefined)
    .replace(/\/\*[\s\S]*?\*\//g,' ')
    .replace(/(^|[^:])\/\/.*$/gm,'$1');
  assert.ok(!/innerHTML/.test(body),
    'the block renderer uses innerHTML, so what came back over the network can be markup');
  assert.match(body, /createTextNode/, 'the prose is not being added as text');
  /* and the whole panel, while we are here */
  const all=read('public/ask.js').replace(/\/\*[\s\S]*?\*\//g,' ');
  assert.ok(!/\.innerHTML\s*=\s*[^`'"]*(mine|text|data)\b/.test(all),
    'something is putting the tutor\'s reply into innerHTML');
});

/* ============================================ the shape of the script
   THE COMMONEST BUG IN THE GAME IS A SHAPE, not a value: a conditional
   sitting BESIDE the loop instead of inside it. Rendered with spaces,
   the working script and the broken one differed by two spaces on two
   lines — and the tutor read it wrong, telling a child whose `if` was
   outside the loop that it "gets checked again and again". That is the
   opposite of true, on the one question stage one exists to teach.

   Bars instead, and an empty mouth that says it is empty. Lifted out of
   ask.js and run against the same small DOM the other renderer test
   uses, so what is exercised is the real walk. */
function scripter(){
  const src=read('public/ask.js');
  const i=src.indexOf('  const BAR=');
  const j=src.indexOf('  /* What the tutor is told about where they are');
  assert.ok(i>0 && j>i, 'ask.js no longer has a script renderer where this can find it');
  const blocksCtx=require('node:vm').createContext({ console });
  blocksCtx.window=blocksCtx; blocksCtx.self=blocksCtx;
  require('node:vm').runInContext(read('public/blocks.js'), blocksCtx, { filename:'blocks.js' });
  const fn=new Function('window','BLOCKS', src.slice(i,j)+'\nreturn { script, words, write };');
  return fn({ BLOCKS:blocksCtx.BLOCKS }, blocksCtx.BLOCKS);
}
const B=(op,args,body)=>{ const b={ op, args:args||{} }; if(body) b.body=body; return b; };
const KEYIF=body=>B('ctrl.if',{ c:B('sense.key',{k:'d'}) }, body);
const STEP=[B('motion.changeBy',{a:'x',n:0.2})];

test('a block inside a loop and a block beside one do not look alike', ()=>{
  const { script }=scripter();
  const working=script({ scripts:[{ hat:B('event.flag'),
    body:[ B('ctrl.forever',{},[ KEYIF(STEP) ]) ] }] });
  const broken=script({ scripts:[{ hat:B('event.flag'),
    body:[ B('ctrl.forever',{},[]), KEYIF(STEP) ] }] });

  assert.notStrictEqual(working, broken, 'the two shapes render identically');
  /* and not by a whisker: the difference has to be a character somebody
     reading it will actually notice */
  const depthOf=(text,needle)=>{
    const line=text.split('\n').find(l=>l.indexOf(needle)>=0);
    return (line.match(/│/g)||[]).length;
  };
  assert.ok(depthOf(working,'if <') > depthOf(working,'forever'),
    'inside the loop, the if is not drawn deeper than the loop');
  assert.strictEqual(depthOf(broken,'if <'), depthOf(broken,'forever'),
    'beside the loop, the if is not drawn at the same depth as the loop');
});

test('an empty loop says it is empty, because that is the bug', ()=>{
  const { script }=scripter();
  const out=script({ scripts:[{ hat:B('event.flag'), body:[ B('ctrl.forever',{},[]) ] }] });
  assert.match(out, /nothing inside it/,
    'a forever with nothing in it renders as a blank, which does not look like anything');
});

test('the tutor is told what the bars mean', ()=>{
  /* The format is only worth anything if it is explained. */
  const board=tutor.board({ script:'when flag\n│ forever' });
  assert.match(board, /│ is one level/i, 'the bars are never explained');
  assert.match(board, /FEWER bars/i, 'nothing says what fewer bars means');
});

test('the whole script still comes through — hats, else, and every block', ()=>{
  const { script }=scripter();
  const out=script({ scripts:[
    { hat:B('event.flag'), body:[ B('ctrl.ifelse',{ c:B('sense.key',{k:'w'}) },
        [B('looks.say',{s:'hi'})]) ] },
    { hat:B('event.key',{k:'space'}), body:[ B('motion.turn',{n:15}) ] } ]});
  assert.match(out, /the game starts/, 'the first hat is missing');
  assert.match(out, /when \[space\] key pressed/, 'the second script is missing');
  assert.match(out, /else/, 'an if/else lost its else');
  assert.match(out, /nothing inside it/, 'the empty else branch is not marked');
  assert.match(out, /say \[hi\]/, 'a block inside the if is missing');
});

/* ===================================================== the editor's fit
   Two bugs the Ask button caused, both from the same shape of mistake:
   a number guessed once and then depended on. */

test('nothing in the editor guesses how tall the bar is', ()=>{
  /* The bar is centred and as wide as its contents, so its HEIGHT
     depends on what is in it and on how narrow the window is. Four rules
     underneath it each hard-coded a guess at that, and adding one button
     made the bar taller than every guess — the walkthrough card slid up
     underneath it and had its first line clipped. */
  const css=read('public/index.html');
  /* Sliced rather than matched: a CSS rule spans lines, and building the
     regex for one through two layers of escaping is how the last version
     of this test came to be hunting for a backslash. */
  const rule=name=>{
    const at=css.indexOf('\n'+name+'{');
    assert.ok(at>=0, 'no rule for '+name);
    const end=css.indexOf('}', at);
    assert.ok(end>at, name+' has no closing brace');
    return css.slice(at, end+1);
  };

  ['#cPal','#cScript','#cCoach'].forEach(sel=>{
    const r=rule(sel);
    const top=/top:\s*([^;}]+)/.exec(r);
    assert.ok(top, sel+' has no top');
    assert.match(top[1], /var\(--cbar/,
      sel+' positions itself with a hard-coded '+top[1].trim()+
      ' instead of measuring where the bar ends');
  });
  const walking=rule('#coder.walking #cPal,#coder.walking #cScript');
  assert.match(walking, /var\(--ccoach/,
    'the panels move down by a fixed amount, so a longer step sentence overlaps them');
});

test('the editor measures the bar and the card, every frame', ()=>{
  const coder=read('public/coder.js');
  assert.match(coder, /function fit\(\)/, 'nothing measures the bar');
  assert.match(coder, /setProperty\('--cbar'/,  'the bar height is never published');
  assert.match(coder, /setProperty\('--ccoach'/,'the card height is never published');
  /* the card is written by COACH, not by coder.js, so a measurement that
     only happened on coder's own render would lag a step behind */
  const tick=coder.slice(coder.indexOf('function tick(dt){'), coder.indexOf('addEventListener(\'keydown\''));
  assert.match(tick, /fit\(\)/, 'the fit is not re-measured as the walkthrough moves');
  const render=coder.slice(coder.indexOf('function render(){'));
  assert.match(render.slice(0,400), /fit\(\)/, 'the fit is not measured after a redraw');
});

test('the page asks whether there is a tutor once, not on every redraw', ()=>{
  /* boot() is called from the editor's bar, which is rebuilt on every
     render AND twice a second by its own tick. Fetching each time was
     four requests a second per child, for as long as the editor was
     open, to ask a question whose answer cannot change while the page is
     loaded. */
  const ask=read('public/ask.js');
  assert.match(ask, /if\(asked===null\)/,
    'boot() has no memory, so every redraw asks the server again');
  const boot=ask.slice(ask.indexOf('function boot()'));
  const body=boot.slice(0, boot.indexOf('\n  }')+4);
  const fetches=(body.match(/fetch\(/g)||[]).length;
  assert.strictEqual(fetches, 1, 'boot() fetches '+fetches+' times per call');
  /* and the handler still goes back on, because the button element is
     new after every rebuild */
  assert.match(ask, /function wire\(\)/, 'nothing re-attaches the button handler');
  assert.match(body, /wire\(\);/, 'a rebuild leaves the button without a click handler');
});

/* ======================================== being able to click the thing
   THE BUG MY OWN TESTS COULD NOT SEE. #coder covers the whole screen and
   is pointer-events:none, so the game behind it stays usable; every
   panel inside it re-enables them for itself. The Ask panel and the
   walkthrough card both forgot — so the text box, the send button, the
   ✕ and "skip the walkthrough" were all click-through, and a click
   landed on the script pane behind them.

   Nothing looked wrong. And every test I had used .click() or
   dispatchEvent, which bypass hit-testing entirely, so all of them
   passed against a panel no mouse could touch. */
test('every panel in the editor can actually be clicked', ()=>{
  const css=read('public/index.html');
  const rule=name=>{
    const at=css.indexOf('\n'+name+'{');
    assert.ok(at>=0, 'no rule for '+name);
    return css.slice(at, css.indexOf('}', at)+1);
  };
  assert.match(rule('#coder'), /pointer-events:\s*none/,
    'the editor no longer lets clicks through to the game — this test is about the case where it does');
  /* every panel that holds something a child has to press */
  ['#cBar','#cPal','#cScript','#cCoach','#tutor'].forEach(sel=>
    assert.match(rule(sel), /pointer-events:\s*auto/,
      sel+' sits inside a pointer-events:none editor and never switches them back on, '+
      'so it is click-through and the click lands on whatever is behind it'));
});

test('Enter sends the question, however the keyboard reports it', ()=>{
  /* Pressing Enter after typing is not an advanced move. Left to the
     form's own implicit submission it depended on conditions this box
     has no business relying on, so it is said out loud — and asked three
     ways, because keyboards, layouts and the numpad do not agree on
     which field is filled in. */
  const ask=read('public/ask.js');
  const at=ask.indexOf("$('#tutIn').onkeydown");
  assert.ok(at>0, 'nothing handles Enter in the question box');
  const body=ask.slice(at, ask.indexOf('};', at));
  ["e.key==='Enter'","e.code==='Enter'","e.code==='NumpadEnter'","e.keyCode===13"].forEach(shape=>
    assert.ok(body.indexOf(shape)>=0, 'Enter is not recognised as '+shape));
  assert.match(body, /e\.shiftKey/, 'shift+enter sends instead of doing nothing');
  assert.match(body, /preventDefault/, 'the keypress is left to also submit the form');
});

/* ============================================ the stream that was empty
   The panel said "(no answer came back)": a 200, the right SSE headers,
   and not one frame in the body. The model was fine — called directly it
   answered — and the framing was fine. The route was throwing every
   frame away.

   IT WAS WATCHING THE WRONG STREAM. `req` is the request BODY, and for a
   POST it closes as soon as that body has been read — about two
   milliseconds in, long before the student has gone anywhere. So the
   "has the client left?" flag was already true when the first token
   arrived, and the guard on it suppressed the lot. `res` is the one that
   closes when the client actually leaves. */
test('the route asks the response whether the client left, not the request', ()=>{
  const src=read('server/index.js');
  /* Comments stripped first: the one above the fix names the bug it
     fixed, and a test reading prose would fail on the sentence
     explaining why the prose is right. */
  const route=src.slice(src.indexOf("app.post('/api/tutor'"), src.indexOf('const PORT'))
    .replace(/\/\*[\s\S]*?\*\//g,' ')
    .replace(/(^|[^:])\/\/.*$/gm,'$1');
  assert.match(route, /res\.on\('close'/,
    'nothing notices when the student closes the tab, so a stream runs on into nothing');
  assert.ok(!/req\.on\('close'/.test(route),
    'the route watches req for close — that fires as soon as the POST body is read, '+
    'so every frame is suppressed and the browser gets an empty stream');
});

test('a POST request really does close before anything is written', async ()=>{
  /* The reason the rule above exists, demonstrated rather than asserted
     — so that if this ever stops being true, the test says so instead of
     quietly guarding against nothing. */
  const express=require('express');
  const app=express();
  app.use(express.json());
  const seen={};
  app.post('/probe',(req,res)=>{
    req.on('close',()=>{ seen.req=true; });
    res.on('close',()=>{ seen.res=true; });
    res.writeHead(200,{ 'Content-Type':'text/event-stream' });
    setTimeout(()=>{
      seen.atWriteTime={ req:!!seen.req, res:!!seen.res };
      res.write('data: "hello"\n\n');
      res.end();
    }, 120);
  });
  const server=await new Promise(r=>{ const s=app.listen(0,()=>r(s)); });
  try{
    const port=server.address().port;
    const body=await fetch('http://localhost:'+port+'/probe',
      { method:'POST', headers:{'Content-Type':'application/json'}, body:'{"a":1}' })
      .then(r=>r.text());
    assert.strictEqual(seen.atWriteTime.req, true,
      'req no longer closes early — the guard in the route can be simplified');
    assert.strictEqual(seen.atWriteTime.res, false,
      'res closed before the client went anywhere, which would break the real guard too');
    assert.match(body, /hello/, 'the client never received the write');
  } finally { server.close(); }
});

/* ================================== the dev sign-in, and its blast radius
   `npm run dev` signs every request in as a local developer row, because
   every feature worth testing is behind sign-in and there is no account
   to sign in with on a laptop. That is a development affordance and a
   security hole anywhere else, so what matters is that it cannot reach
   anywhere else. */
test('the dev sign-in lives only in the dev harness', ()=>{
  const dev=read('tools/dev-server.js');
  assert.match(dev, /auth\.fromReq\s*=/, 'the dev harness no longer signs requests in');
  /* Nothing that ships may require it, and nothing under server/ may
     mention it. The deployed server starts at server/index.js. */
  ['server/index.js','server/auth.js','server/db.js','server/tutor.js','server/mechmatch.js']
    .forEach(f=>{
      const s=read(f);
      assert.ok(s.indexOf('dev-server')<0, f+' refers to the dev harness');
      assert.ok(!/DEV_SIGNED_IN/.test(s), f+' reads the dev sign-in switch');
    });
  assert.strictEqual(require('../package.json').scripts.start, 'node server/index.js',
    'npm start no longer goes straight to the real server');
});

test('it is not an account: no password, and nothing registered', ()=>{
  /* A row in an array that vanishes with the process. If this ever grows
     a password or a call to the register route, it has stopped being a
     fixture and become a credential. */
  /* Comments stripped, for the third time in this file: the paragraph
     above the fixture says "nothing is registered", and a test reading
     prose fails on the sentence promising the thing it checks. */
  const dev=read('tools/dev-server.js')
    .replace(/\/\*[\s\S]*?\*\//g,' ')
    .replace(/(^|[^:])\/\/.*$/gm,'$1');
  const at=dev.indexOf('const DEV =');
  assert.ok(at>0, 'the dev row is gone');
  const block=dev.slice(at, at+600);
  assert.match(block, /pass_hash:\s*''/, 'the dev row has been given a password hash');
  assert.match(block, /salt:\s*''/,      'the dev row has been given a salt');
  assert.ok(!/makeHash\(|\/api\/register/.test(dev),
    'the dev harness is hashing a password or calling the register route — '+
    'that would make it a credential rather than a fixture');
});

test('the signed-out half can still be tested', ()=>{
  /* Being permanently signed in would make the 401s, the "not signed in"
     message and what a visitor sees impossible to look at locally. */
  const dev=read('tools/dev-server.js');
  assert.match(dev, /DEV_SIGNED_IN/, 'there is no way to get the signed-out behaviour back');
  assert.match(dev, /if\(SIGNED_IN\)/, 'the sign-in cannot actually be switched off');
});
