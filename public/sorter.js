/* =====================================================================
   THE MECHANIC'S BELT — one question per part, and the question is an
   expression you build out of and, or and not.

   WHAT THIS TEACHES, AND WHY IT IS NOT THE PRE-FLIGHT AGAIN. shipfix.js
   meets each of the nine words once, in a place where only that word will
   do: `>=` in a rule about "at least", `and` in a rule with a floor and a
   ceiling, `not` over a single comparison. That is meeting a vocabulary.

   This is USING it. Every job here is one expression with several
   conditions in it, and the difficulty is no longer which word means what
   — it is what a whole expression comes out as when the parts of it
   disagree. Three things live in that gap and nothing else in the game
   reaches them:

     TWO GAUGES AT ONCE. The pre-flight's `and` joins two facts about the
     same number (psi over 8, psi under 40). Joining two DIFFERENT gauges
     is the ordinary case in real code and it reads differently: there is
     no single dial to picture.

     A BARE BOOLEAN IS ALREADY A QUESTION. `cracked` does not need
     comparing to anything, and `not cracked` is how you say it is fine.
     A student who has just learnt `==` reaches for `cracked == 0` every
     time; the short form is here to be met.

     AND `not` OVER A GROUP, which is the whole of the third job. "Leave
     the cracked ones, leave the hot ones" becomes `not (cracked or hot)`,
     and almost everybody writes `not (cracked and hot)` first, because
     the English had an "and" in it. Those two disagree on exactly the
     parts where one thing is wrong and the other is fine, and the belt
     carries both of them.

   NO LADDERS, NO BRANCHES, NO ORDER. There is one expression and it is
   true or it is false. Nothing here is sequenced, nothing shadows
   anything, and the belt asks every part the same single question.

   THE ENGINE IS KLOGIC AND THERE IS NO SECOND ONE. logic.js has the
   condition tree and the operator table, and `value()` is a boolean
   evaluator with no ladder in it. A second evaluator here would be a
   second answer that no test ever sees — the same argument preflight.js
   makes about shipfix.js.

   NO DOM, AND IT RUNS UNDER NODE. sortfix.js is the screen.
   ===================================================================== */
(function(root){

  const L = () => (typeof module!=='undefined' && module.exports)
                  ? require('./logic.js') : root.KLOGIC;

  /* --------------------------------------------------------- the gauges
     What the belt can read off a part. Two numbers and one yes/no, so an
     expression can join two different dials or lean on a bare boolean. */
  const GAUGES = [
    { id:'heat',    name:'heat' },
    { id:'load',    name:'load' },
    { id:'cracked', name:'cracked', bool:true }
  ];
  const OPS_OK = ['<','<=','>','>=','==','!='];
  const JOINS  = ['and','or'];

  /* ------------------------------------------------------------ the jobs
     `want` is what the Mechanic says about each part, written as a plain
     function rather than as a second expression — a second expression
     would be the answer key, and a student's work would be marked by
     comparing it to one we already had. This way the belt describes the
     JOB, and any expression that satisfies it is right.

     THE ARM EITHER TAKES A PART OR LEAVES IT. One question, one answer,
     and the answer is a boolean. */
  const JOBS = [
    /* ---------------------------------------------------------- one
       BOTH AT ONCE, ACROSS TWO GAUGES. The belt carries every mix of
       whole against cracked and hot against cool, so `and` and `or`
       disagree on three of the six parts and there is no passing by
       accident. The boundary of "cool" is on it twice, at 899 and 900,
       because `<` and `<=` agree everywhere else in the world. */
    { id:'both', name:'THE ARM',
      says: 'Take a part only if it is cool AND not cracked.',
      hint: 'Two things at once. What joins them?',
      vars: ['heat','cracked'],
      form: { k:'#j1', a:{ k:'cmp', v:'heat', op:'#o1', n:'#n1' },
                       b:{ k:'not', a:{ k:'var', v:'cracked' } } },
      pick: { '#j1':JOINS, '#o1':OPS_OK, '#n1':[200,400,900] },
      belt: [
        { heat:120,  cracked:0 },
        { heat:899,  cracked:0 },
        { heat:900,  cracked:0 },      // the boundary of "cool"
        { heat:120,  cracked:1 },      // cool but cracked: `or` takes it
        { heat:1200, cracked:1 },
        { heat:1200, cracked:0 }       // hot but whole: `or` takes it too
      ],
      want: p => p.heat<900 && !p.cracked },

    /* ---------------------------------------------------------- two
       EITHER WILL DO, two different gauges again. The belt carries one
       part that passes each side alone, one that passes both and one that
       passes neither, so `and` is wrong on two of them. */
    { id:'either', name:'THE SECOND ARM',
      says: 'Take it if it is light OR cool. Either will do.',
      hint: 'One of them is enough. Both is fine too.',
      vars: ['load','heat'],
      form: { k:'#j1', a:{ k:'cmp', v:'load', op:'#o1', n:'#n1' },
                       b:{ k:'cmp', v:'heat', op:'#o2', n:'#n2' } },
      pick: { '#j1':JOINS, '#o1':OPS_OK, '#n1':[200,400,900],
                           '#o2':OPS_OK, '#n2':[200,400,900] },
      belt: [
        { load:120, heat:1200 },       // light only
        { load:800, heat:150  },       // cool only
        { load:120, heat:150  },       // both
        { load:800, heat:1200 },       // neither
        { load:200, heat:1200 },       // the boundary of "light"
        { load:800, heat:400  },       // and of "cool"
        /* BETWEEN THE TWO CANDIDATE NUMBERS. Without this the belt had
           nothing carrying a heat between 200 and 400, so `heat < 200`
           and `heat < 400` agreed on every part and the job had three
           right answers. A check that cannot tell two answers apart
           cannot tell a student which one they picked. */
        { load:800, heat:300  }
      ],
      want: p => p.load<200 || p.heat<400 },

    /* -------------------------------------------------------- three
       NOT OVER A GROUP, and this is the job the other two are for.

       The Mechanic says it with an "and" in it — leave the cracked ones
       AND leave the hot ones — and the expression that means that is
       `not (cracked or hot)`. Writing `not (cracked and hot)` is the
       first thing nearly everybody does, and it only rejects the parts
       where BOTH are wrong: a cool cracked part and a hot whole one both
       come back onto the belt. So the belt carries one of each, and they
       are the two rows that go red. */
    { id:'neither', name:'THE REJECT ARM',
      says: 'Leave the cracked ones. Leave the hot ones. Take the rest.',
      hint: 'One "not" over the group. Mind which word goes inside it.',
      vars: ['heat','cracked'],
      form: { k:'not', a:{ k:'#j1', a:{ k:'var', v:'cracked' },
                                    b:{ k:'cmp', v:'heat', op:'#o1', n:'#n1' } } },
      pick: { '#j1':JOINS, '#o1':OPS_OK, '#n1':[200,400,900] },
      belt: [
        { heat:150,  cracked:0 },
        { heat:899,  cracked:0 },
        { heat:150,  cracked:1 },      // cracked but cool
        { heat:1200, cracked:0 },      // hot but whole
        { heat:1200, cracked:1 },      // both wrong
        { heat:900,  cracked:0 }       // the boundary
      ],
      want: p => !(p.cracked || p.heat>=900) }
  ];
  const jobOf = id => JOBS.find(j=>j.id===id) || null;

  /* ------------------------------------------------------------- state
     What a student has put in each blank. Nothing to start with — an
     empty blank is not a wrong answer and is never counted as one. */
  const blank = () => ({ fill:{} });

  /* Every hole in a job, as {slot, kind, choices}, in reading order.
     Walked by the screen to draw the blanks and by the tests to fill
     them. A slot written twice is one blank, not two. */
  function holes(job){
    const out=[];
    const walk = n => {
      if(!n || typeof n!=='object') return;
      /* A JOINING BLANK IS WRITTEN BETWEEN ITS TWO SIDES, so it is
         collected between them too.

         It used to be pushed on the way IN, before either side, which put
         it first in this list while it sat third on the screen. Nothing
         looked wrong: the expression drew correctly and every blank was
         fillable. But `holes()` is also what the panel walks to decide
         which blank to arm NEXT after a word is placed — so the ring
         jumped from the operator to the joining word in the middle and
         back to the number, and the word list changed under a student who
         was reading left to right. Same order as the screen, always. */
      if(typeof n.k==='string' && n.k[0]==='#'){
        walk(n.a);
        out.push({ slot:n.k, kind:'join', choices:(job.pick&&job.pick[n.k])||JOINS });
        walk(n.b);
        return;
      }
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
    walk(job.form);
    const seen=new Set();
    return out.filter(h=>seen.has(h.slot) ? false : (seen.add(h.slot), true));
  }

  /* The expression as KLOGIC wants it, with every hole replaced by what
     the student put in it. A hole still empty makes the whole thing null:
     an expression with a gap in it has no value, which is a different
     thing from being false. */
  function build(job, state){
    const fill=(state&&state.fill)||{};
    const sub = h => {
      if(typeof h!=='string' || h[0]!=='#') return h;
      const v=fill[h];
      return (v===undefined || v===null || v==='') ? null : v;
    };
    const put = n => {
      if(!n || typeof n!=='object') return n;
      const kind = (typeof n.k==='string' && n.k[0]==='#') ? sub(n.k) : n.k;
      if(kind===null) return null;
      if(kind==='cmp'){
        const v=sub(n.v), op=sub(n.op), num=sub(n.n);
        if(v===null || op===null || num===null) return null;
        return { k:'cmp', v, op, n:num };
      }
      if(kind==='var') return { k:'var', v:n.v };
      if(kind==='not'){ const a=put(n.a); return a===null ? null : { k:'not', a }; }
      const a=put(n.a), b=put(n.b);
      if(a===null || b===null) return null;
      return { k:kind, a, b };
    };
    return put(job.form);
  }

  const filled = (job, state) =>
    holes(job).every(h => { const v=((state&&state.fill)||{})[h.slot];
                            return v!==undefined && v!==null && v!==''; });

  /* KLOGIC reads a boolean off the state by name, and a part carries
     `cracked` as 0 or 1 so the belt's column reads like a gauge. */
  function stateOf(part){
    const st=Object.assign({}, part);
    st.cracked=!!part.cracked;
    return st;
  }

  /* ---------------------------------------------------------------- run
     What the expression says about every part, against what the Mechanic
     says. KLOGIC evaluates; nothing here decides anything.

     AN UNFINISHED EXPRESSION ANSWERS NOTHING. Left to itself a missing
     piece reads as not-true, so every part would come out NO and the belt
     would fill with confident red before the student had touched it — a
     column of mistakes they have not made yet. */
  function rows(job, state){
    const K=L(), tree=build(job, state), waiting=!filled(job, state);
    return job.belt.map(part=>{
      const want=!!job.want(part);
      if(waiting || !tree) return { part, got:null, want, ok:false, blank:true };
      let got=null;
      try{ got=K.value(tree, stateOf(part)); }catch(e){ got=null; }
      return { part, got, want, ok: got!==null && !!got===want, blank:got===null };
    });
  }

  const done = (job, state) => {
    if(!filled(job, state)) return false;
    const rs=rows(job, state);
    return rs.length>0 && rs.every(r=>r.ok);
  };

  /* ------------------------------------------- WHERE IT COMES APART
     THE ONE THING THIS CONSOLE VOLUNTEERS, and it is the only thing that
     makes a compound expression learnable: for the first part it gets
     wrong, what each PIECE of the expression said about that part.

     `NO and YES` is a sentence a nine-year-old can finish. Reading
     `cracked or heat > 900` and working out in their head what it does to
     a part that is cool and cracked is not — that is precisely the step
     they are here to practise, and watching the machine take it once is
     how anybody learns to take it themselves.

     NOTHING IS SAID ABOUT WHICH WORD IS WRONG. The pieces are shown with
     their values and the whole answer at the end; what to change is the
     student's to work out. */
  function why(job, state){
    if(!filled(job, state)) return null;
    const bad=rows(job, state).find(r=>!r.ok);
    if(!bad) return null;
    const K=L(), st=stateOf(bad.part), tree=build(job, state);
    /* The expression flattened to its readable pieces, each with what it
       came out as on this part, depth-first so they appear in the order
       they are written on screen. */
    const parts=[];
    (function walk(n){
      if(!n) return;
      if(n.k==='and' || n.k==='or'){ walk(n.a); parts.push({ join:n.k }); walk(n.b); return; }
      if(n.k==='not'){
        /* The value goes on the CLOSING bracket, not the opening one.
           `not(=YES cracked=YES and heat>=900=NO )` reads as though the
           word "not" were itself true of something; `not ( cracked=YES
           and heat>=900=NO ) =YES` reads as what it is — a group, worked
           out, and then flipped. */
        let v=null; try{ v=K.value(n, st); }catch(e){}
        parts.push({ text:'not', open:true });
        walk(n.a);
        parts.push({ close:true, value:v });
        return;
      }
      let v=null;
      try{ v=K.value(n, st); }catch(e){}
      parts.push({ text:K.text(n), value:v });
    })(tree);
    return { part:bad.part, got:bad.got, want:bad.want, parts };
  }

  const API = { GAUGES, OPS_OK, JOINS, JOBS, jobOf,
                blank, holes, build, filled, rows, done, why };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.SORTER=API;
})(typeof self!=='undefined' ? self : this);
