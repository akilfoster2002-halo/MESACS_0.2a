/* =====================================================================
   THE MECHANIC'S BELT — three ladders, and the order of them is the
   lesson.

   WHAT THIS TEACHES, AND WHY IT IS NOT THE PRE-FLIGHT AGAIN. shipfix.js
   teaches the nine WORDS a condition is made of — `<` against `<=`, and
   which of them means "at least". The Engineer's Trail teaches READING a
   ladder somebody else wrote and working out who must have opened a gate.
   Neither of them ever asks a student to WRITE one, and writing one has a
   difficulty all of its own that neither can reach:

       A BRANCH UNDER A TRUE ONE IS NOT FALSE. IT IS NEVER ASKED.

   That is the whole of it. `heat > 900` is a perfectly good condition and
   it can still be dead code, because `heat > 400` sits above it and every
   part over 900 is also over 400. Nothing about the condition is wrong.
   Nothing a student can see by reading it is wrong. It only shows up when
   a part at 1200 degrees rolls past and goes to the COOLER, and the only
   way to understand why is to be told which branches the machine never
   looked at — which is exactly what KLOGIC.run() already reports.

   SO THE ENGINE IS KLOGIC AND THERE IS NO SECOND ONE. logic.js has the
   condition tree, the operators, the ladder walker and the trace with
   `tested:false` on the branches that were skipped. A second evaluator in
   here would be a second answer that no test ever sees — the same
   argument preflight.js makes about shipfix.js, and the reason that file
   has no comparison table in it either.

   WHAT A JOB IS. A ladder with holes in it and a belt of parts that have
   already been judged:

     order : the branches arrive shuffled and the conditions are written.
             The student moves lines. Nothing else.
     fill  : the order is right and a condition has a blank in it.
     both  : neither is given.

   THE BELT IS THE ASSESSMENT, and every part on it is chosen. There is
   always one that only comes out right when the specific rule sits above
   the general one, because a belt that never carries a part over 900 is a
   belt that cannot tell a student which of two orders they have picked —
   the same argument preflight.js makes about trying FUEL at exactly 20.

   NO DOM, AND IT RUNS UNDER NODE. sortfix.js is the screen.
   ===================================================================== */
(function(root){

  const L = () => (typeof module!=='undefined' && module.exports)
                  ? require('./logic.js') : root.KLOGIC;

  /* ------------------------------------------------------------ the bins
     Where a part can end up. Three, and they are three because two would
     not need a ladder and four would not teach anything three does not. */
  const BINS = [
    { id:'SCRAP',  name:'SCRAP',  tint:'#ff9aa2' },
    { id:'COOLER', name:'COOLER', tint:'#8fd3ff' },
    { id:'SHELF',  name:'SHELF',  tint:'#a8e6cf' }
  ];

  /* --------------------------------------------------------- the pieces
     What a student can put in a blank. Three kinds, and they are kept
     apart for the same reason preflight.js keeps `and` out of a slot that
     compares two numbers: a wrong KIND of answer is a different mistake
     from a wrong answer, and a console that cannot tell them apart has
     taught nothing.

       gauge : something the belt can read off a part
       op    : how to compare it
       n     : a number to compare it against                            */
  const GAUGES = [
    { id:'heat',    name:'heat' },
    { id:'cracked', name:'cracked', bool:true }
  ];
  const OPS_OK = ['<','<=','>','>=','==','!='];

  /* ------------------------------------------------------------- the job
     `want` is what the Mechanic says each part should do, and it is
     written as a plain function of the part rather than as a second
     ladder — a second ladder would be the answer key, and a student's
     ladder would be marked by comparing it to the one we already had.
     This way the belt is a description of the JOB and any ladder that
     satisfies it is right. */
  const JOBS = [
    /* ---------------------------------------------------------- one
       ORDER ONLY. Every condition is written and correct; three of the
       four lines are in the wrong order. The belt carries a part at 1200
       which is both over 900 and over 400, so the two orders disagree on
       it and on nothing else. */
    { id:'order', kind:'order', name:'SORTING',
      says: 'Put my rules in the right order.',
      hint: 'The first true line wins. Nothing under it is even asked.',
      vars: ['heat','cracked'],
      /* The order they arrive in, which is wrong on purpose. */
      branches: [
        { cond:{ k:'cmp', v:'heat', op:'>', n:400 }, action:'COOLER' },
        { cond:{ k:'cmp', v:'heat', op:'>', n:900 }, action:'SCRAP'  },
        { cond:{ k:'var', v:'cracked' },             action:'SCRAP'  },
        { kind:'else',                               action:'SHELF'  }
      ],
      belt: [
        { heat:1200, cracked:0 },      // over 900 AND over 400: the whole lesson
        { heat:620,  cracked:0 },
        { heat:180,  cracked:0 },
        { heat:120,  cracked:1 },      // cool, but cracked
        { heat:950,  cracked:1 }
      ],
      want: p => p.cracked ? 'SCRAP' : p.heat>900 ? 'SCRAP'
               : p.heat>400 ? 'COOLER' : 'SHELF' },

    /* ---------------------------------------------------------- two
       FILL THE BLANK. The order is right and cannot be changed; two
       conditions have holes in them. The belt tries the boundary of each,
       so `>` and `>=` come apart on it. */
    { id:'fill', kind:'fill', name:'THE CUT-OFF',
      says: 'The numbers moved. Write the two lines again.',
      hint: 'Try it at exactly the number. That is where two answers differ.',
      vars: ['heat','cracked'],
      branches: [
        { cond:{ k:'var', v:'cracked' },                       action:'SCRAP'  },
        { cond:{ k:'cmp', v:'#g1', op:'#o1', n:'#n1' },         action:'SCRAP'  },
        { cond:{ k:'cmp', v:'#g2', op:'#o2', n:'#n2' },         action:'COOLER' },
        { kind:'else',                                         action:'SHELF'  }
      ],
      /* What goes in each blank is never written down. The belt decides. */
      pick: { '#g1':GAUGES.map(g=>g.id), '#o1':OPS_OK, '#n1':[200,400,500,800],
              '#g2':GAUGES.map(g=>g.id), '#o2':OPS_OK, '#n2':[200,400,500,800] },
      belt: [
        { heat:800, cracked:0 },       // exactly the scrap line
        { heat:799, cracked:0 },
        { heat:500, cracked:0 },       // exactly the cooler line
        { heat:499, cracked:0 },
        { heat:60,  cracked:0 },
        { heat:60,  cracked:1 }
      ],
      want: p => p.cracked ? 'SCRAP' : p.heat>=800 ? 'SCRAP'
               : p.heat>=500 ? 'COOLER' : 'SHELF' },

    /* ---------------------------------------------------------- three
       BOTH, AND A RULE THAT NEEDS TWO THINGS AT ONCE. A cracked part is
       only worth scrapping if it is also hot; a cool cracked one is worth
       mending, so the top line is an `and`. Order still matters: the
       mend line has to sit above the plain scrap line or it is never
       asked. */
    { id:'both', kind:'both', name:'THE NEW RULE',
      says: 'A cool cracked part is worth mending. Hot ones are not.',
      hint: 'Two things at once is one line, not two.',
      vars: ['heat','cracked'],
      branches: [
        { cond:{ k:'and', a:{ k:'var', v:'cracked' },
                          b:{ k:'cmp', v:'#g1', op:'#o1', n:'#n1' } }, action:'SHELF'  },
        { cond:{ k:'var', v:'cracked' },                               action:'SCRAP'  },
        { cond:{ k:'cmp', v:'#g2', op:'#o2', n:'#n2' },                action:'COOLER' },
        { kind:'else',                                                 action:'SHELF'  }
      ],
      pick: { '#g1':GAUGES.map(g=>g.id), '#o1':OPS_OK, '#n1':[100,300,600,900],
              '#g2':GAUGES.map(g=>g.id), '#o2':OPS_OK, '#n2':[100,300,600,900] },
      belt: [
        { heat:90,  cracked:1 },       // cool and cracked: mend it
        { heat:300, cracked:1 },       // the boundary of "cool"
        { heat:301, cracked:1 },
        { heat:800, cracked:1 },       // hot and cracked: scrap
        { heat:700, cracked:0 },
        { heat:50,  cracked:0 }
      ],
      want: p => (p.cracked && p.heat<=300) ? 'SHELF'
               : p.cracked ? 'SCRAP'
               : p.heat>300 ? 'COOLER' : 'SHELF' }
  ];
  const jobOf = id => JOBS.find(j=>j.id===id) || null;

  /* ------------------------------------------------------------- state
     What a student has built: an order for the branches, and something in
     each blank. Nothing is filled in to start with — an empty blank is
     not a wrong answer and is never counted as one. */
  function blank(job){
    return { order: job.branches.map((_,i)=>i), fill: {} };
  }

  /* Every hole in a job, as {slot, kind, choices}. Walked by the screen to
     draw the blanks and by the tests to fill them. */
  function holes(job){
    const out=[];
    const walk = n => {
      if(!n || typeof n!=='object') return;
      if(n.k==='cmp'){
        for(const [key,kind] of [['v','gauge'],['op','op'],['n','n']]){
          const h=n[key];
          if(typeof h==='string' && h[0]==='#')
            out.push({ slot:h, kind, choices:(job.pick&&job.pick[h])||[] });
        }
        return;
      }
      walk(n.a); walk(n.b);
    };
    (job.branches||[]).forEach(b=>walk(b.cond));
    /* One entry per slot, in the order they are read. A slot that appears
       twice in one ladder is one blank, not two. */
    const seen=new Set();
    return out.filter(h=>seen.has(h.slot) ? false : (seen.add(h.slot), true));
  }

  /* The ladder as KLOGIC wants it: branches in the student's order, holes
     replaced by whatever they have put in them, and `kind` recomputed so
     whichever line is on top is the `if`. A ladder that starts with
     `elif` is not a ladder. */
  function build(job, state){
    const s=state||blank(job);
    const fill=s.fill||{};
    const put = n => {
      if(!n || typeof n!=='object') return n;
      if(n.k==='cmp'){
        const v=sub(n.v), op=sub(n.op), num=sub(n.n);
        if(v===null || op===null || num===null) return null;   // a hole: no answer
        return { k:'cmp', v, op, n:num };
      }
      if(n.k==='var') return n;
      const a=put(n.a), b=put(n.b);
      if(a===null || (n.b!==undefined && b===null)) return null;
      return Object.assign({}, n, { a, b });
    };
    const sub = h => {
      if(typeof h!=='string' || h[0]!=='#') return h;
      const v=fill[h];
      return (v===undefined || v===null || v==='') ? null : v;
    };
    /* The else is pinned to the bottom wherever the student left it — it
       is not a condition and there is nothing for it to be above. */
    const listed=(s.order||job.branches.map((_,i)=>i)).map(i=>job.branches[i]).filter(Boolean);
    const body=listed.filter(b=>b.kind!=='else');
    const tail=listed.filter(b=>b.kind==='else');
    const branches=body.map((b,i)=>({ kind: i===0?'if':'elif',
                                      cond: put(b.cond), action:b.action }))
                       .concat(tail.map(b=>({ kind:'else', action:b.action })));
    return { branches };
  }

  /* Is every blank filled? A ladder with a hole in it has no answer at
     all, which is a different thing from a wrong one. */
  const filled = (job, state) =>
    holes(job).every(h => { const v=(state&&state.fill||{})[h.slot];
                            return v!==undefined && v!==null && v!==''; });

  /* ---------------------------------------------------------------- run
     What the ladder did to every part on the belt, and what the job says
     it should have done. KLOGIC walks it; nothing here decides anything. */
  function rows(job, state){
    const K=L(), rule=build(job, state);
    /* A LADDER WITH A HOLE IN IT HAS NO ANSWER, and that is not the same
       thing as a wrong one.

       Left to itself the walker does something perfectly reasonable and
       completely misleading here: a branch whose condition is still blank
       evaluates as not-true, so every part falls through to the `else`
       and the belt fills up with confident answers — half of them red —
       before the student has typed anything at all. The first thing they
       would see is a column of mistakes they have not made yet.

       So an unfinished ladder reports nothing, the way the pre-flight
       draws a dash in a rule it cannot evaluate. */
    const waiting=!filled(job, state);
    return job.belt.map(part=>{
      const want=job.want(part);
      if(waiting) return { part, got:null, want, ok:false, blank:true,
                           branch:-1, trace:[] };
      const st=Object.assign({}, part);
      /* KLOGIC reads booleans off the state by name, and a part carries
         `cracked` as 0 or 1 so the belt reads like a gauge. */
      st.cracked = !!part.cracked;
      let r;
      try{ r=K.run(rule, st); }catch(e){ r={ branch:-1, action:null, trace:[] }; }
      return { part, got:r.action, want, ok: r.action===want,
               blank:false, branch:r.branch, trace:r.trace };
    });
  }

  /* Finished and right: every part on the belt goes where the job says. */
  function done(job, state){
    if(!filled(job, state)) return false;
    const rs=rows(job, state);
    return rs.length>0 && rs.every(r=>r.ok);
  }

  /* ------------------------------------------------- what to say about it
     A BRANCH THAT WAS NEVER ASKED is the one thing this lesson exists to
     show, and it is invisible in the ladder itself — the line is right
     there, spelled correctly, doing nothing. So when a ladder is finished
     and still wrong, look for a line the belt never once reached and name
     it. KLOGIC already marks them `tested:false`.

     Only when it is the actual fault. A ladder can have an unreachable
     line and still route every part correctly (the line is redundant, not
     wrong), and telling somebody off for that would be telling them off
     for something that works. */
  function dead(job, state){
    if(!filled(job, state)) return null;
    const rs=rows(job, state);
    if(rs.every(r=>r.ok)) return null;
    const K=L(), rule=build(job, state), list=rule.branches||[];

    /* SHADOWED IS NOT THE SAME AS NEVER EVALUATED, and the difference is
       the entire bug this function exists to report.

       Put `heat > 400` above `heat > 900` and the 900 line still gets
       LOOKED AT all day — every cool part reaches it and finds it false.
       It is simply never TRUE by the time anything gets to it, because
       everything that would satisfy it was caught one line up. Counting
       the lines the belt never reached therefore finds nothing at all,
       which is what the first version of this did.

       So: a line that never RUNS, although its own condition is true of
       some part on the belt all by itself. That is exactly "something
       above this is eating your cases", and it is the only thing here
       worth saying out loud. */
    for(let i=0;i<list.length;i++){
      const b=list[i];
      if(b.kind==='else' || !b.cond) continue;
      const ranAny=rs.some(r=>(r.trace||[]).some(tr=>tr.i===i && tr.ran));
      if(ranAny) continue;
      const trueAny=job.belt.some(part=>{
        const st=Object.assign({}, part); st.cracked=!!part.cracked;
        try{ return !!K.value(b.cond, st); }catch(e){ return false; }
      });
      if(!trueAny) continue;          // not shadowed, just never applicable
      return { at:i, action:b.action, text:K.text(b.cond) };
    }
    return null;
  }

  /* The first part the ladder gets wrong, said as what happened to it. */
  function miss(job, state){
    if(!filled(job, state)) return null;
    const bad=rows(job, state).find(r=>!r.ok);
    if(!bad) return null;
    return { part:bad.part, got:bad.got, want:bad.want };
  }

  /* ------------------------------------------------------------ moving
     Reorder is KLOGIC's, so the rule about which line becomes the `if`
     and where an `else` may sit is written once. This only moves the
     student's index list about. */
  function move(job, state, from, to){
    const s=state||blank(job);
    const order=(s.order||[]).slice();
    /* The else stays at the bottom: it is not a condition and there is
       nothing for it to be above. */
    const isElse = i => job.branches[i] && job.branches[i].kind==='else';
    const body=order.filter(i=>!isElse(i)), tail=order.filter(isElse);
    if(from<0 || from>=body.length || to<0 || to>=body.length) return s;
    body.splice(to, 0, body.splice(from,1)[0]);
    return Object.assign({}, s, { order: body.concat(tail) });
  }

  const API = { BINS, GAUGES, OPS_OK, JOBS, jobOf,
                blank, holes, build, filled, rows, done, dead, miss, move };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.SORTER=API;
})(typeof self!=='undefined' ? self : this);
