/* =====================================================================
   PROGRAM — the console's language, with no screen attached.

   code.js is the console: a palette, a drag, a textarea, a mission's
   walkthrough. This is the part underneath that has nothing to do with
   any of it — the shape of a block, how a tree of them becomes the flat
   list of steps that actually runs, and how many blocks that tree is.

   It lives on its own for one reason: a PvP battle is judged by the
   server, and the server has no DOM. The referee has to be able to take
   the tree a student submitted and compile it with the very same code
   that compiled it in their browser, or the fight they watched and the
   fight that counted are two different fights. One compiler, two
   runtimes — so this file is a plain script in the browser and a module
   under Node, and nothing in it touches a window.

   THE STEP LIST. Every step carries the id of the block it came from,
   which is what lets a mission highlight the running block, blame the
   one that crashed you, and — in a battle — say WHY turn 18 did what it
   did. Steps whose name starts __ are bookkeeping rather than actions:

     __iter   one pass of a repeat, for the counter on screen
     __if     a test; `jump` is where to land when it is false
     __until  a test at the top of a loop; `jump` is past the end of it
     __loop   the bottom of an until-loop; `back` is the __until
     __call   stepping into a define

   repeat is UNROLLED at compile time — three passes are three copies —
   because every mission so far steps through a finite tape. `until` is
   the first loop whose length is not known until it is run, so it is the
   first to need real jumps.
   ===================================================================== */
(function(root){

  /* blocks that carry a typed number, and what that number is called */
  const NUMBLK={ setX:'col', setY:'row', addX:'dx', addY:'dy', turn:'deg' };

  /* how many blocks a tree is — a repeat counts as one, plus what is inside */
  function countBlocks(list){
    let n=0;
    for(const b of (list||[])){ n++; if(b.body) n+=countBlocks(b.body); }
    return n;
  }

  /* how deeply nested it goes, so a rule can cap it */
  function depthOf(list){
    let d=0;
    for(const b of (list||[])) if(b.body) d=Math.max(d, 1+depthOf(b.body));
    return d;
  }

  /* the one `define` in a program, wherever it was put */
  function findDefine(list){
    for(const b of (list||[])){
      if(b.type==='define') return b;
      if(b.body){ const f=findDefine(b.body); if(f) return f; }
    }
    return null;
  }

  /* --------------------------------------------------------- compile
     `root` is the whole program even while we are down inside a body,
     because a call() has to find the define no matter where either of
     them was written. */
  function compile(list, opts){
    opts=opts||{};
    const root = opts.root || list;
    const out=[], guard={n:0};
    walk(list, out, guard, 0, root);
    return out;
  }
  function walk(list, out, guard, depth, root){
    for(const b of (list||[])){
      if(guard.n++ > 600) break;
      if(b.type==='define') continue;              // a definition only runs when called
      if(b.type==='repeat'){
        for(let i=0;i<b.count;i++){
          out.push({name:'__iter', blockId:b.id, i:i+1, n:b.count});
          walk(b.body, out, guard, depth, root);
        }
      } else if(b.type==='ifc'){
        const at=out.length;
        out.push({name:'__if', blockId:b.id, cond:b.cond, jump:0});
        walk(b.body, out, guard, depth, root);
        out[at].jump=out.length;                   // where to land when the test is false
      } else if(b.type==='until'){
        /* repeat until: test at the top, jump back at the bottom. The test
           is written the way it reads — TRUE means stop — so `jump` leaves
           the loop and falling through enters the body. */
        const at=out.length;
        out.push({name:'__until', blockId:b.id, cond:b.cond, jump:0});
        walk(b.body, out, guard, depth, root);
        out.push({name:'__loop', blockId:b.id, back:at});
        out[at].jump=out.length;
      } else if(b.type==='call'){
        const def=findDefine(root);
        if(def && depth<4){
          out.push({name:'__call', blockId:b.id});
          walk(def.body, out, guard, depth+1, root);
        }
      } else if(b.type==='goTo'){
        out.push({name:'goTo', blockId:b.id, col:b.col, row:b.row});
      } else if(NUMBLK[b.type]){
        out.push({name:b.type, blockId:b.id, n:b.n});
      } else out.push({name:b.type, blockId:b.id});
    }
    return out;
  }

  /* ------------------------------------------------------- validation
     What a referee asks of a program before it is allowed into a match.
     Every answer is a sentence a student can act on, not a code — the
     point of being told no is knowing what to change.

     `allow` is the list of block types this match permits, which is the
     same list the palette was built from: a program can only contain
     what the student was actually offered. */
  function validate(list, rules){
    rules=rules||{};
    const errs=[];
    const n=countBlocks(list);
    if(rules.limit && n>rules.limit)
      errs.push({ code:'over-budget',
        msg:'That is '+n+' blocks and the limit is '+rules.limit+'.' });
    if(rules.maxDepth && depthOf(list)>rules.maxDepth)
      errs.push({ code:'too-deep',
        msg:'Loops inside loops only go '+rules.maxDepth+' deep here.' });
    if(!n) errs.push({ code:'empty', msg:'There is no program to run.' });

    const allow = rules.allow ? new Set(rules.allow) : null;
    const conds = rules.conds ? new Set(rules.conds) : null;
    (function scan(l){
      for(const b of (l||[])){
        if(allow && !allow.has(b.type))
          errs.push({ code:'not-allowed', blockId:b.id,
            msg:'"'+b.type+'" is not one of the blocks in this match.' });
        if(conds && (b.type==='ifc'||b.type==='until') && !conds.has(b.cond))
          errs.push({ code:'bad-condition', blockId:b.id,
            msg:'"'+b.cond+'" is not a sensor this mech has.' });
        if(b.type==='repeat' && !(b.count>=1 && b.count<=100))
          errs.push({ code:'bad-count', blockId:b.id,
            msg:'A repeat has to count between 1 and 100.' });
        if(b.body) scan(b.body);
      }
    })(list);

    return { ok:!errs.length, errors:errs, blocks:n };
  }

  const API = { NUMBLK, countBlocks, depthOf, findDefine, compile, validate };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.PROGRAM=API;
})(typeof self!=='undefined' ? self : this);
