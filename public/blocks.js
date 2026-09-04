/* =====================================================================
   BLOCKS — the language, as data.

   Every block a student can write is one row here: its shape, its
   category, the words it reads as, and the slots inside it. The editor
   renders from this table and the VM executes from the same table, so a
   block cannot exist in one and be missing from the other.

   SHAPES, which is really the grammar:
     hat     starts a script     — when ▶ clicked
     stack   does something      — move 10 steps
     c       wraps other blocks  — repeat 10 [ ... ]
     c2      wraps two           — if <> [ ... ] else [ ... ]
     cap     ends a script       — stop this script
     report  gives a number/text — x position, 3 + 4
     bool    gives a yes or no   — touching player?

   A slot's type says what may drop into it: `num` and `str` take a typed
   value or any reporter, `bool` takes only a boolean block, `var` and
   `msg` are dropdowns over things the project has made.
   ===================================================================== */
window.BLOCKS = (function(){

  const CATS=[
    { id:'events',  name:'Events',    a:'#ffd8a8' },
    { id:'control', name:'Control',   a:'#ffb4a2' },
    { id:'motion',  name:'Motion',    a:'#8fd3ff' },
    { id:'looks',   name:'Looks',     a:'#cdb4f6' },
    { id:'sensing', name:'Sensing',   a:'#a8e6cf' },
    { id:'ops',     name:'Operators', a:'#9fe6b4' },
    { id:'data',    name:'Variables', a:'#ffc48f' },
    { id:'my',      name:'My Blocks', a:'#ff9aa2' }
  ];

  const n=(d)=>({type:'num',def:d});
  const s=(d)=>({type:'str',def:d});
  const b=()=>({type:'bool'});
  const B=(op,cat,kind,label,args)=>({op,cat,kind,label,args:args||{}});

  const LIST=[
    /* ------------------------------------------------------------ events */
    B('event.flag','events','hat','when ▶ clicked'),
    B('event.key','events','hat','when %k key pressed',{k:{type:'key',def:'space'}}),
    B('event.recv','events','hat','when I receive %m',{m:{type:'msg',def:'message1'}}),
    B('event.clone','events','hat','when I start as a clone'),
    B('event.send','events','stack','broadcast %m',{m:{type:'msg',def:'message1'}}),
    B('event.sendWait','events','stack','broadcast %m and wait',{m:{type:'msg',def:'message1'}}),

    /* ----------------------------------------------------------- control */
    B('ctrl.wait','control','stack','wait %n seconds',{n:n(1)}),
    B('ctrl.repeat','control','c','repeat %n',{n:n(10)}),
    B('ctrl.forever','control','c','forever'),
    B('ctrl.if','control','c','if %c then',{c:b()}),
    B('ctrl.ifelse','control','c2','if %c then',{c:b()}),
    B('ctrl.waitUntil','control','stack','wait until %c',{c:b()}),
    B('ctrl.repeatUntil','control','c','repeat until %c',{c:b()}),
    B('ctrl.stop','control','cap','stop %w',{w:{type:'pick',opts:['this script','all'],def:'this script'}}),
    B('ctrl.clone','control','stack','create a clone of myself'),
    B('ctrl.delclone','control','cap','delete this clone'),

    /* ------------------------------------------------------------ motion */
    B('motion.move','motion','stack','move %n steps',{n:n(10)}),
    B('motion.turn','motion','stack','turn %n degrees',{n:n(15)}),
    B('motion.tilt','motion','stack','tilt %n degrees',{n:n(15)}),
    B('motion.goto','motion','stack','go to x %x y %y z %z',{x:n(0),y:n(1),z:n(0)}),
    B('motion.glide','motion','stack','glide %t secs to x %x y %y z %z',{t:n(1),x:n(0),y:n(1),z:n(0)}),
    B('motion.changeBy','motion','stack','change %a by %n',{a:{type:'pick',opts:['x','y','z'],def:'y'},n:n(1)}),
    B('motion.setTo','motion','stack','set %a to %n',{a:{type:'pick',opts:['x','y','z'],def:'y'},n:n(0)}),
    B('motion.point','motion','stack','point towards %o',{o:{type:'obj',def:'player'}}),
    B('motion.pos','motion','report','%a position',{a:{type:'pick',opts:['x','y','z'],def:'x'}}),
    B('motion.dir','motion','report','direction'),

    /* ------------------------------------------------------------- looks */
    B('looks.say','looks','stack','say %s',{s:s('Hello!')}),
    B('looks.sayFor','looks','stack','say %s for %n secs',{s:s('Hello!'),n:n(2)}),
    B('looks.colour','looks','stack','set colour to %s',{s:{type:'colour',def:'#8fd3ff'}}),
    B('looks.size','looks','stack','set size to %n',{n:n(1)}),
    B('looks.changeSize','looks','stack','change size by %n',{n:n(0.2)}),
    B('looks.show','looks','stack','show'),
    B('looks.hide','looks','stack','hide'),
    B('looks.shape','looks','stack','become a %s',{s:{type:'pick',opts:['cube','ball','cylinder','cone'],def:'cube'}}),

    /* ----------------------------------------------------------- sensing */
    B('sense.dist','sensing','report','distance to %o',{o:{type:'obj',def:'player'}}),
    B('sense.touch','sensing','bool','touching %o ?',{o:{type:'obj',def:'player'}}),
    B('sense.key','sensing','bool','key %k pressed?',{k:{type:'key',def:'space'}}),
    B('sense.posOf','sensing','report','%a of %o',{a:{type:'pick',opts:['x','y','z'],def:'x'},o:{type:'obj',def:'player'}}),
    B('sense.timer','sensing','report','timer'),
    B('sense.resetTimer','sensing','stack','reset timer'),
    B('sense.count','sensing','report','number of %o',{o:{type:'obj',def:'clones'}}),

    /* --------------------------------------------------------- operators */
    B('op.add','ops','report','%a + %b',{a:n(1),b:n(1)}),
    B('op.sub','ops','report','%a − %b',{a:n(1),b:n(1)}),
    B('op.mul','ops','report','%a × %b',{a:n(2),b:n(3)}),
    B('op.div','ops','report','%a ÷ %b',{a:n(6),b:n(2)}),
    B('op.mod','ops','report','%a mod %b',{a:n(7),b:n(3)}),
    B('op.round','ops','report','round %a',{a:n(1.5)}),
    B('op.math','ops','report','%f of %a',{f:{type:'pick',opts:['abs','sqrt','sin','cos','floor','ceil'],def:'sqrt'},a:n(9)}),
    B('op.random','ops','report','pick random %a to %b',{a:n(1),b:n(10)}),
    B('op.lt','ops','bool','%a < %b',{a:n(0),b:n(10)}),
    B('op.gt','ops','bool','%a > %b',{a:n(0),b:n(10)}),
    B('op.eq','ops','bool','%a = %b',{a:s('a'),b:s('a')}),
    B('op.and','ops','bool','%c and %d',{c:b(),d:b()}),
    B('op.or','ops','bool','%c or %d',{c:b(),d:b()}),
    B('op.not','ops','bool','not %c',{c:b()}),
    B('op.join','ops','report','join %a %b',{a:s('hello '),b:s('world')}),

    /* --------------------------------------------------------- variables */
    B('data.set','data','stack','set %v to %n',{v:{type:'var',def:''},n:s('0')}),
    B('data.change','data','stack','change %v by %n',{v:{type:'var',def:''},n:n(1)}),
    B('data.get','data','report','%v',{v:{type:'var',def:''}}),
    B('list.add','data','stack','add %n to %l',{n:s('thing'),l:{type:'list',def:''}}),
    B('list.del','data','stack','delete %n of %l',{n:n(1),l:{type:'list',def:''}}),
    B('list.clear','data','stack','delete all of %l',{l:{type:'list',def:''}}),
    B('list.item','data','report','item %n of %l',{n:n(1),l:{type:'list',def:''}}),
    B('list.len','data','report','length of %l',{l:{type:'list',def:''}}),

    /* --------------------------------------------------------- my blocks */
    B('my.call','my','stack','%p',{p:{type:'proc',def:''}})
  ];

  const BY={}; LIST.forEach(x=>BY[x.op]=x);
  const of = op => BY[op]||null;
  const inCat = c => LIST.filter(x=>x.cat===c);
  const catOf = id => CATS.find(c=>c.id===id) || CATS[0];

  /* split a label into words and %slots so the editor can lay it out */
  function parts(label){
    return String(label).split(/(%[a-z])/).filter(x=>x!=='');
  }
  const isExpr = k => k==='report' || k==='bool';

  return { CATS, LIST, of, inCat, catOf, parts, isExpr };
})();
