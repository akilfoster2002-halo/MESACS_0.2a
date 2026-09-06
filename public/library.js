/* =====================================================================
   THE LIBRARY — every word in the language, in one searchable place.

   A palette teaches you what exists only while you are looking at it,
   and only the few blocks the mission handed you. This is the other
   half: the whole language at once, searchable, with what each block
   does written out and a worked line you can copy into Free Play.

   It is built FROM THE LANGUAGE ITSELF rather than typed out again —
   the shelves read BLOCKS.LIST and BLOCKS.HELP, which is the same table
   the editor renders from and the VM executes from. So a block cannot
   exist in the game and be missing from the library, and a block cannot
   be described here in a way it does not behave.

   The concepts on the front shelf are the exception: loops, variables,
   coordinates and the rest are ideas rather than blocks, so they are
   written here and nowhere else.
   ===================================================================== */
window.LIBRARY = (function(){

  /* The ideas. These are not blocks, so they have no table to come from —
     each says what the word means and shows the smallest real use of it. */
  const IDEAS=[
    { term:'Command', tags:'instruction statement do',
      what:'One instruction. The computer does it once, exactly as written, then moves to the next line down.',
      eg:'move 10 steps' },
    { term:'Sequence', tags:'order top bottom first',
      what:'The order your blocks run in: strictly top to bottom. Put a turn in the wrong place and everything after it walks the wrong way.',
      eg:'move 10 steps\nturn 90 degrees\nmove 10 steps' },
    { term:'Loop', tags:'repeat forever again iteration',
      what:'Runs the blocks inside it more than once, so you write the move once instead of ten times. A square is one side and one turn, repeated four times.',
      eg:'repeat 4\n  move 10 steps\n  turn 90 degrees' },
    { term:'Nested loop', tags:'loop inside repeat within pattern',
      what:'A loop inside another loop. The inner one finishes completely on every single turn of the outer one, which is how a pattern of patterns fits in a small program.',
      eg:'repeat 3\n  repeat 4\n    move 10 steps\n    turn 90 degrees\n  turn 30 degrees' },
    { term:'Event', tags:'when start hat trigger',
      what:'Something that happens, which starts a script running. Nothing in a project runs at all until an event sets it off.',
      eg:'when ▶ clicked\n  move 10 steps' },
    { term:'Variable', tags:'box store remember score data',
      what:'A named box that remembers one value. Put things in it, change it, and read it back out. score is a variable; so is anything you make.',
      eg:'set score to 0\nchange score by 1\nsay score' },
    { term:'Coordinate', tags:'x y position lane grid absolute',
      what:'Where something is, as numbers. x is how far across and y is how far up. SET puts you at a number; CHANGE adds to the number you already have. Minus goes the other way.',
      eg:'set x to 2        put me in column 2\nchange x by 1     one to the right\nchange x by -1    one to the left' },
    { term:'Condition', tags:'if else test true false boolean',
      what:'A question with a yes or no answer. An if block asks it once and only runs the blocks inside when the answer is yes.',
      eg:'if <touching player?>\n  say "found you"' },
    { term:'Function', tags:'define my block procedure reuse call',
      what:'A move you teach the computer once and then call by name. If you find yourself writing the same four blocks in three places, that is a function waiting to happen.',
      eg:'define combo\n  move 10 steps\n  turn 90 degrees\n\ncombo' },
    { term:'Clone', tags:'copy duplicate spawn',
      what:'A copy of an object made while the program runs. Clones run their own scripts and disappear when you delete them, so one object can become a hundred.',
      eg:'create a clone of myself' },
    { term:'Message', tags:'broadcast receive talk between',
      what:'A shout every object hears at once. It is how one object tells the others that something happened, without either of them knowing about the other.',
      eg:'broadcast "go"\n\nwhen I receive "go"\n  move 10 steps' }
  ];

  /* ------------------------------------------------------------ the index
     Built once from the language table, so it can never drift out of step
     with what the editor and the VM actually do. */
  let INDEX=null;
  function index(){
    if(INDEX) return INDEX;
    INDEX=[];
    IDEAS.forEach(i=>INDEX.push({
      kind:'idea', cat:'Ideas', a:'#ffe9a8',
      term:i.term, what:i.what, eg:i.eg,
      hay:(i.term+' '+i.tags+' '+i.what).toLowerCase() }));
    if(window.BLOCKS) BLOCKS.LIST.forEach(b=>{
      const c=BLOCKS.catOf(b.cat);
      const label=readable(b.label);
      INDEX.push({
        kind:'block', cat:c.name, a:c.a, op:b.op,
        term:label, what:BLOCKS.help(b.op) || t('A {c} block.',{c:c.name}),
        eg:label,
        hay:(label+' '+b.op+' '+c.name+' '+(BLOCKS.help(b.op)||'')).toLowerCase() });
    });
    return INDEX;
  }
  /* a block's label carries %n style slots — show them as something readable */
  function readable(label){
    return String(label).replace(/%[a-z]/g, m=>({
      '%n':'( )', '%s':'( )', '%b':'< >', '%v':'[var]', '%m':'[msg]' }[m] || '( )'));
  }

  /* ------------------------------------------------------------------ UI */
  let el=null, q='';
  function build(){
    el=document.createElement('div'); el.id='library'; el.className='hidden';
    el.innerHTML=`
      <div class="lib-card">
        <div class="lib-head">
          <b>📚 <span id="libTitle"></span></b>
          <input id="libQ" type="search" autocomplete="off" spellcheck="false">
          <button class="btn small ghost" id="libX">✕</button>
        </div>
        <div class="lib-cats" id="libCats"></div>
        <div class="lib-body" id="libBody"></div>
        <div class="lib-foot"><span id="libCount"></span></div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#libX').onclick=close;
    const input=el.querySelector('#libQ');
    input.oninput=()=>{ q=input.value.trim().toLowerCase(); draw(); };
    /* the search box eats every key, so typing "c" here must not open the
       code console and Escape must close the book rather than the game */
    input.onkeydown=e=>{
      e.stopPropagation();
      if(e.key==='Escape'){ input.blur(); close(); }
    };
    el.onclick=e=>{ if(e.target===el) close(); };
  }
  let cat='';
  function draw(){
    const all=index();
    const cats=[]; all.forEach(i=>{ if(cats.indexOf(i.cat)<0) cats.push(i.cat); });
    el.querySelector('#libTitle').textContent=t('THE LIBRARY');
    el.querySelector('#libQ').placeholder=t('Search a word, a block or an idea…');
    const cbox=el.querySelector('#libCats');
    cbox.innerHTML=[t('Everything')].concat(cats).map(c=>{
      const id=c===t('Everything')?'':c;
      return `<button class="libcat${cat===id?' on':''}" data-cat="${id}">${c}</button>`;
    }).join('');
    cbox.querySelectorAll('[data-cat]').forEach(b=>
      b.onclick=()=>{ cat=b.dataset.cat; draw(); });

    const hits=all.filter(i=>(!cat || i.cat===cat) && (!q || i.hay.indexOf(q)>=0));
    el.querySelector('#libBody').innerHTML = hits.length
      ? hits.map(i=>`<div class="libit" style="--a:${i.a}">
            <div class="li-top"><b>${esc(i.term)}</b><span>${esc(i.cat)}</span></div>
            <p>${esc(i.what)}</p>
            ${i.eg?`<pre>${esc(i.eg)}</pre>`:''}
          </div>`).join('')
      : `<div class="lib-none">${t('Nothing matches “{q}”. Try a shorter word.',{q:esc(q)})}</div>`;
    el.querySelector('#libCount').textContent=
      t('{n} of {m} entries',{n:hits.length, m:all.length});
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function open(){
    if(!el) build();
    q=''; cat='';
    el.classList.remove('hidden');
    draw();
    if(document.pointerLockElement) document.exitPointerLock();
    const i=el.querySelector('#libQ'); i.value=''; setTimeout(()=>i.focus(),30);
  }
  function close(){
    if(!el) return;
    el.classList.add('hidden');
    if(window.PLANET && PLANET.active) lockPointer(document.querySelector('#view'));
  }
  const isOpen = () => !!el && !el.classList.contains('hidden');

  return { open, close, isOpen, index, IDEAS };
})();
