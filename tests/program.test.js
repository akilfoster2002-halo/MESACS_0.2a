/* The compiler, on its own. If these break, every mission breaks with them. */
const test = require('node:test');
const assert = require('node:assert');
const P = require('../public/program.js');

const B = (id,type,extra) => Object.assign({id,type}, extra||{});
const names = steps => steps.map(s=>s.name);

test('a flat program compiles to itself', ()=>{
  const p=[B(1,'forward'), B(2,'shoot')];
  assert.deepStrictEqual(names(P.compile(p)), ['forward','shoot']);
});

test('repeat is unrolled, and every pass is announced', ()=>{
  const p=[B(1,'repeat',{count:3,body:[B(2,'forward')]})];
  const s=P.compile(p);
  assert.deepStrictEqual(names(s),
    ['__iter','forward','__iter','forward','__iter','forward']);
  assert.deepStrictEqual(s.filter(x=>x.name==='__iter').map(x=>x.i), [1,2,3]);
});

test('a loop inside a loop is nine passes, not six', ()=>{
  const p=[B(1,'repeat',{count:3,body:[B(2,'repeat',{count:3,body:[B(3,'forward')]})]})];
  assert.strictEqual(P.compile(p).filter(s=>s.name==='forward').length, 9);
});

test('if carries the jump past its own body', ()=>{
  const p=[B(1,'ifc',{cond:'enemy ahead',body:[B(2,'shoot')]}), B(3,'forward')];
  const s=P.compile(p);
  assert.strictEqual(s[0].name,'__if');
  assert.strictEqual(s[0].jump, 2);          // lands on `forward` when false
  assert.strictEqual(s[s[0].jump].name,'forward');
});

test('repeat-until jumps forward to leave and back to go round', ()=>{
  const p=[B(1,'until',{cond:'wall ahead',body:[B(2,'forward')]}), B(3,'shoot')];
  const s=P.compile(p);
  assert.deepStrictEqual(names(s), ['__until','forward','__loop','shoot']);
  assert.strictEqual(s[0].jump, 3);          // true = out of the loop, onto shoot
  assert.strictEqual(s[2].back, 0);          // and the bottom goes back to the test
});

test('every step remembers the block it came from', ()=>{
  const p=[B(7,'repeat',{count:2,body:[B(9,'shoot')]})];
  P.compile(p).forEach(s=>assert.ok(s.blockId===7 || s.blockId===9));
});

test('a define only runs where it is called', ()=>{
  const p=[B(1,'define',{body:[B(2,'shoot')]}), B(3,'call')];
  assert.deepStrictEqual(names(P.compile(p)), ['__call','shoot']);
});

test('a define found anywhere is still the one that is called', ()=>{
  const p=[B(1,'repeat',{count:1,body:[B(2,'define',{body:[B(3,'shoot')]})]}), B(4,'call')];
  assert.ok(names(P.compile(p)).includes('shoot'));
});

test('recursion has a floor rather than a stack overflow', ()=>{
  const p=[B(1,'define',{body:[B(2,'call')]}), B(3,'call')];
  const s=P.compile(p);                       // must terminate at all
  assert.ok(s.length < 600);
});

test('counting blocks counts what is inside the loops', ()=>{
  const p=[B(1,'repeat',{count:9,body:[B(2,'forward'),B(3,'shoot')]})];
  assert.strictEqual(P.countBlocks(p), 3);    // the repeat is one block, not nine
  assert.strictEqual(P.depthOf(p), 1);
});

test('validation refuses a program over the limit, and says by how much', ()=>{
  const p=[B(1,'forward'),B(2,'forward'),B(3,'forward')];
  const v=P.validate(p,{limit:2});
  assert.strictEqual(v.ok,false);
  assert.strictEqual(v.errors[0].code,'over-budget');
  assert.match(v.errors[0].msg, /3 blocks/);
});

test('validation refuses a block the match never offered', ()=>{
  const v=P.validate([B(1,'nuke')],{allow:['forward','shoot']});
  assert.strictEqual(v.errors[0].code,'not-allowed');
  assert.strictEqual(v.errors[0].blockId,1);
});

test('validation refuses a sensor this mech has not got', ()=>{
  const v=P.validate([B(1,'ifc',{cond:'x-ray',body:[]})],
    {allow:['ifc'],conds:['enemy ahead']});
  assert.strictEqual(v.errors[0].code,'bad-condition');
});

test('validation refuses an empty program', ()=>{
  assert.strictEqual(P.validate([],{}).errors[0].code,'empty');
});

test('validation caps how deep loops may nest', ()=>{
  const p=[B(1,'repeat',{count:2,body:[B(2,'repeat',{count:2,body:[
           B(3,'repeat',{count:2,body:[B(4,'forward')]})]})]})];
  assert.strictEqual(P.validate(p,{maxDepth:2}).errors[0].code,'too-deep');
  assert.strictEqual(P.validate(p,{maxDepth:3}).ok, true);
});
