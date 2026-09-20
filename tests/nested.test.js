/* =====================================================================
   A FIELD BELONGS TO THE BLOCK IT IS PRINTED IN.

   A reporter dropped into a slot is drawn INSIDE its host's element —
   `if <key [w] pressed?>` is one .cblk with the key block's own markup
   nested in it. So closest('[data-blk]') climbs past the reporter and
   finds the host, and for a long time every field inside a nested block
   read and wrote the block AROUND it:

     · picking a key in `if <key [w] pressed?>` put a stray k on the `if`
       and left the key block alone, so the menu snapped back — which
       looks exactly like a dropdown that does not work;
     · typing into a number box two reporters deep set the wrong block's
       argument;
     · the ✕ on an inner reporter cleared the outer block's slot, taking
       the whole condition with it;
     · and a dragged reporter landed on the host instead of the slot it
       was dropped on.

   Only blocks in the script tree have a path, so there is nothing to
   resolve a nested reporter by. The nest spans carry the slot they fill
   and holderOf() walks down them. It needs a DOM, and this suite has no
   DOM library — so the function is cut out of coder.js and run against a
   few objects that answer parentElement, dataset and closest, which is
   all of the DOM it touches.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const coder = read('public/coder.js');

/* ------------------------------------------------- the smallest DOM
   Enough of an element to be walked up and matched against the two
   selectors holderOf uses, and nothing else. */
function node(cls, data, kids){
  const n={ className:cls||'', dataset:data||{}, children:[], parentElement:null };
  (kids||[]).forEach(k=>{ k.parentElement=n; n.children.push(k); });
  n.closest=function(sel){
    for(let p=this; p; p=p.parentElement){
      if(sel==='[data-blk]' && p.dataset.blk!==undefined) return p;
      if(sel.charAt(0)==='.' && (' '+p.className+' ').indexOf(' '+sel.slice(1)+' ')>=0) return p;
    }
    return null;
  };
  return n;
}
/* the tree coder.js really renders for
       if < (1 + 2) > 10  and  key [s] pressed? >
   which is a block, a nest for the `and`, a nest for the `>`, a nest for
   the `+`, and the fields and ✕ buttons that go with each. */
function tree(){
  const numB   = node('cin',  { set:'b', slot:'b' });
  const clrAdd = node('bx',   { clear:'a' });               // empties op.gt's a
  const nestAdd= node('cnest',{ nest:'a' }, [numB, clrAdd]);
  const clrGt  = node('bx',   { clear:'c' });               // empties op.and's c
  const nestGt = node('cnest',{ nest:'c' }, [nestAdd, clrGt]);
  const keySel = node('cin ckey', { set:'k' });
  const clrKey = node('bx',   { clear:'d' });               // empties op.and's d
  const nestKey= node('cnest',{ nest:'d' }, [keySel, clrKey]);
  const clrAnd = node('bx',   { clear:'c' });               // empties the if's c
  const nestAnd= node('cnest',{ nest:'c' }, [nestGt, nestKey, clrAnd]);
  const blk    = node('cblk', { blk:'0.1' }, [nestAnd]);
  const script = node('cscript', { sc:'0' }, [blk]);
  return { numB, clrAdd, clrGt, keySel, clrKey, clrAnd, blk, script };
}

/* the real holderOf, lifted out of coder.js by brace-matching */
function holderOfWith(rootBlock, hat){
  const i=coder.indexOf('function holderOf(');
  assert.ok(i>0, 'coder.js no longer has a holderOf to test');
  let d=0, end=-1;
  for(let k=coder.indexOf('{',i);k<coder.length;k++){
    if(coder[k]==='{') d++;
    else if(coder[k]==='}'){ d--; if(!d){ end=k+1; break; } }
  }
  const at     = p => p==='0.1' ? { block:rootBlock } : null;
  const hatOf  = () => hat||null;
  return new Function('at','hatOf', coder.slice(i,end)+'; return holderOf;')(at,hatOf);
}

/* the program those nests are drawn from */
function program(){
  const add={ op:'op.add', args:{ a:1, b:2 } };
  const gt ={ op:'op.gt',  args:{ a:add, b:10 } };
  const key={ op:'sense.key', args:{ k:'s' } };
  const and={ op:'op.and', args:{ c:gt, d:key } };
  const iff={ op:'ctrl.if', args:{ c:and }, body:[] };
  return { add, gt, key, and, iff };
}

/* ==================================================================== */
test('a field resolves to the reporter it is printed in, not the block around it', ()=>{
  const p=program(), t=tree();
  const holderOf=holderOfWith(p.iff);
  assert.strictEqual(holderOf(t.keySel), p.key,
    'the key menu still belongs to the block around it — this is the reported bug');
  assert.strictEqual(holderOf(t.numB), p.add,
    'a number three reporters deep resolves to the wrong block');
});

test('the ✕ on a nested reporter empties the slot that holds it', ()=>{
  const p=program(), t=tree();
  const holderOf=holderOfWith(p.iff);
  /* each ✕ sits inside the very span it empties, so its own nest is not
     walked into — dropLast is what says so */
  assert.strictEqual(holderOf(t.clrAnd, true), p.iff,  'the outer ✕ clears the wrong block');
  assert.strictEqual(holderOf(t.clrGt,  true), p.and,  'the ✕ on > clears the wrong block');
  assert.strictEqual(holderOf(t.clrAdd, true), p.gt,   'the ✕ on + clears the wrong block');
  assert.strictEqual(holderOf(t.clrKey, true), p.and,  'the ✕ on the key block clears the wrong block');
});

test('a field on a plain unnested block still resolves to that block', ()=>{
  const p=program();
  const inp=node('cin',{ set:'n' });
  const blk=node('cblk',{ blk:'0.1' },[inp]);
  node('cscript',{ sc:'0' },[blk]);
  assert.strictEqual(holderOfWith(p.iff)(inp), p.iff);
});

test('a field on a hat resolves to the hat', ()=>{
  const hat={ op:'event.key', args:{ k:'space' } };
  const sel=node('cin ckey',{ set:'k' });
  node('cscript',{ sc:'0' },[sel]);            // no [data-blk]: hats have none
  assert.strictEqual(holderOfWith(null, hat)(sel), hat);
});

test('a nest naming a slot that holds no block resolves to nothing, not a crash', ()=>{
  const p=program();
  const inp=node('cin',{ set:'k' });
  const bad=node('cnest',{ nest:'zzz' },[inp]);      // a slot the if does not have
  const blk=node('cblk',{ blk:'0.1' },[bad]);
  node('cscript',{ sc:'0' },[blk]);
  assert.strictEqual(holderOfWith(p.iff)(inp), null);
});

test('nothing in the editor works out a field\'s block the old way', ()=>{
  /* The four handlers that used to climb to the nearest [data-blk] and
     call it the owner. If one comes back, so does the bug. */
  const body=coder.slice(coder.indexOf('function wireScript('));
  const owners=body.match(/closest\('\[data-blk\]'\)/g)||[];
  /* the block's own click and drag handlers legitimately want the block
     element itself; the field handlers must go through holderOf */
  ['[data-set]','[data-slot].bool','[data-clear]'].forEach(sel=>{
    const i=body.indexOf(sel); assert.ok(i>0, 'no handler for '+sel);
    const chunk=body.slice(i, i+420);
    assert.ok(!/closest\('\[data-blk\]'\)/.test(chunk),
      sel+' works out its owner by climbing to the nearest block again');
    assert.match(chunk, /holderOf\(/, sel+' does not go through holderOf');
  });
  const zones=coder.slice(coder.indexOf('function slotZones('));
  assert.ok(!/closest\('\[data-blk\]'\)/.test(zones.slice(0,400)),
    'slotZones still climbs to the nearest block, so drops land on the host');
  assert.match(zones.slice(0,400), /holderOf\(/, 'slotZones does not go through holderOf');
  assert.ok(owners.length<=2,
    'a new handler is working out a field owner the old way ('+owners.length+' sites)');
});

test('the nest spans carry the slot they fill, or there is nothing to walk', ()=>{
  assert.match(coder, /class="cnest" data-nest="\$\{k\}"/,
    'the nested-block span no longer says which slot it fills');
});
