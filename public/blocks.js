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
    B('event.flag','events','hat','when ▶ the game starts'),
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
    B('looks.shape','looks','stack','become a %s',{s:{type:'costume',def:'cube'}}),

    /* ----------------------------------------------------------- sensing */
    B('sense.dist','sensing','report','distance to %o',{o:{type:'obj',def:'player'}}),
    B('sense.touch','sensing','bool','touching %o ?',{o:{type:'obj',def:'player',edge:true}}),
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


  /* ------------------------------------------------------------- help
     One plain sentence per block, for the magnifying glass. Written for a
     student who has not met the idea before: what it does, and when you
     would reach for it — never a restatement of the block's own words. */
  const HELP = {
    'event.flag':"Starts this script when somebody presses Run. Most projects begin with one of these.",
    'event.key':"Starts this script the moment that key goes down. Good for controls — one script per key.",
    'event.recv':"Starts this script when any object broadcasts that message. It is how objects talk to each other.",
    'event.clone':"Runs only in a copy made by 'create a clone of myself'. The original ignores it.",
    'event.send':"Shouts a message to every object at once. Anything with a matching 'when I receive' wakes up.",
    'event.sendWait':"Same as broadcast, but this script pauses until every script that answered has finished.",

    'ctrl.wait':"Pauses just this script for a while. Other scripts keep running.",
    'ctrl.repeat':"Does the blocks inside a set number of times, then carries on below.",
    'ctrl.forever':"Does the blocks inside over and over and never moves past. Nothing below it will ever run.",
    'ctrl.if':"Checks the diamond once. If it is true, runs the blocks inside; if not, skips them.",
    'ctrl.ifelse':"Runs the first set of blocks when the diamond is true, and the second set when it is false.",
    'ctrl.waitUntil':"Holds this script here until the diamond becomes true, then carries on.",
    'ctrl.repeatUntil':"Keeps doing the blocks inside until the diamond becomes true. Checks before each go.",
    'ctrl.stop':"Stops this one script, or every script in the project.",
    'ctrl.clone':"Makes a copy of this object at the same spot. The copy runs its own 'when I start as a clone'.",
    'ctrl.delclone':"Removes this copy. Has no effect on the original object.",

    'motion.move':"Slides forward in whatever direction the object is facing. Turn first to change where that is.",
    'motion.turn':"Spins the object left or right on the spot. Negative numbers turn the other way.",
    'motion.tilt':"Tips the object forward or back, rather than turning it.",
    'motion.goto':"Jumps straight to an exact spot. x is left-right, y is up-down, z is near-far.",
    'motion.glide':"Slides smoothly to a spot over the time you give it, instead of jumping there.",
    'motion.changeBy':"Nudges one coordinate by an amount. 'change y by 1' lifts the object a little.",
    'motion.setTo':"Sets one coordinate exactly, leaving the other two alone.",
    'motion.point':"Turns to face something. Handy just before 'move', to chase it.",
    'motion.pos':"Reports where the object is on one axis. Drop it into a slot to do maths with it.",
    'motion.dir':"Reports which way the object is facing, in degrees.",

    'looks.say':"Puts a speech bubble over the object and leaves it there until you say something else.",
    'looks.sayFor':"Shows a speech bubble, waits, then clears it by itself.",
    'looks.colour':"Repaints the object.",
    'looks.size':"Sets how big the object is. 1 is normal, 2 is twice as big.",
    'looks.changeSize':"Grows or shrinks the object a bit. Negative numbers shrink it.",
    'looks.show':"Makes the object visible again after hiding.",
    'looks.hide':"Makes the object invisible. Its scripts keep running while it is hidden.",
    'looks.shape':"Changes the object's costume — a shape, or anybody out of the kits. Mid-program, so a car can become a person.",

    'sense.dist':"Reports how far away something is. Compare it with a number to react when it gets close.",
    'sense.touch':"True while the object is touching that thing. Pick 'edge' for the walls of the room — that is how you keep something from wandering out.",
    'sense.key':"True while that key is held down. Use it inside 'forever' for smooth controls.",
    'sense.posOf':"Reports one coordinate of another object — how you make one thing follow another.",
    'sense.timer':"Counts seconds since the project started or the timer was reset.",
    'sense.resetTimer':"Puts the timer back to zero.",
    'sense.count':"Counts how many clones exist, or how many objects share a name.",

    'op.add':"Adds the two numbers together and reports the answer.",
    'op.sub':"Takes the second number away from the first.",
    'op.mul':"Multiplies the two numbers.",
    'op.div':"Divides the first number by the second.",
    'op.mod':"Reports the remainder after dividing. 'x mod 2' is 0 for even numbers — a neat way to alternate.",
    'op.round':"Rounds to the nearest whole number.",
    'op.math':"Does one piece of maths to a number: square root, absolute value, sine and so on.",
    'op.random':"Picks a fresh number between the two, every single time it is read.",
    'op.lt':"True when the first number is smaller than the second.",
    'op.gt':"True when the first number is bigger than the second.",
    'op.eq':"True when the two are the same. Works on words as well as numbers.",
    'op.and':"True only when BOTH diamonds are true.",
    'op.or':"True when EITHER diamond is true.",
    'op.not':"Flips a diamond over: true becomes false.",
    'op.join':"Sticks two pieces of text together, so you can say things like 'score: 12'.",

    'data.set':"Puts a value into a variable, throwing away whatever was there.",
    'data.change':"Adds to what a variable already holds. Use 1 to count things up.",
    'data.get':"Reports what a variable is holding right now. Drop it into any slot.",
    'list.add':"Puts something on the end of a list.",
    'list.del':"Removes one item. The first item is number 1, not 0.",
    'list.clear':"Empties the list completely.",
    'list.item':"Reports one item out of a list, counting from 1.",
    'list.len':"Reports how many things are in the list.",

    'my.call':"Runs a block you defined yourself. Anything you build twice is worth turning into one of these."
  };
  const help = op => HELP[op] || '';

  const BY={}; LIST.forEach(x=>BY[x.op]=x);
  const of = op => BY[op]||null;
  const inCat = c => LIST.filter(x=>x.cat===c);
  const catOf = id => CATS.find(c=>c.id===id) || CATS[0];

  /* split a label into words and %slots so the editor can lay it out */
  function parts(label){
    return String(label).split(/(%[a-z])/).filter(x=>x!=='');
  }
  const isExpr = k => k==='report' || k==='bool';

  return { CATS, LIST, of, inCat, catOf, parts, isExpr, help };
})();
