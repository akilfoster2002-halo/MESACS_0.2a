/* =====================================================================
   TWENTY QUESTIONS ABOUT AND, OR AND NOT — in English, with answers to
   pick from.

   WHAT THIS REPLACED, AND WHY. The belt asked a student to assemble a
   boolean expression out of blanks: pick a comparison, pick a number,
   pick a joining word, and read a six-row table to find out whether the
   thing you had built agreed with a man in a workshop. Every part of that
   was defensible and the whole of it was a cockpit. Before a nine-year-old
   can choose between `and` and `or` they have to know what the two words
   DO, and an expression builder assumes that knowledge on the way to
   testing something else. This asks the question directly.

   PLAIN ENGLISH, AND ALMOST NO SYMBOLS. Two of the twenty use the words
   `true` and `false` as values because that is a thing worth meeting;
   none of them use `<`, `&&` or a bracket. A student who finishes this
   knows what the three words mean and can tell you the opposite of "both
   lights are on", which is the whole of what Mission 8 needs them to
   have.

   THE ORDER IS THE LESSON. Five on what the words mean, five on working
   small ones out, five on reading a rule somebody gives you, and five on
   turning a rule inside out — which is De Morgan, and the last one is an
   implication written as an `or`, which most adults have never noticed
   they know.

   AND A WRONG ANSWER IS NOT A PUNISHMENT. It says why, in one sentence,
   and the question comes back at the end. You go round again on just the
   ones you missed until there are none left, so the quiz ends when the
   student knows all twenty rather than when they have seen all twenty.
   ===================================================================== */
(function(root){

  /* `a` is the index of the right answer. `why` is shown after ANY answer,
     right or wrong, because the reason is the lesson and getting it right
     by luck is the case that most needs it. */
  /* =============================================== SIXTY QUESTIONS, ONE
     SUBJECT: THE SIX COMPARISONS.

       <   less than            >   more than
       <=  at most              >=  at least
       ==  exactly              !=  not the same as

     THERE USED TO BE FORTY ABOUT `and`, `or` and `not` AS WELL, and they
     were cut on purpose. Joining two conditions together is a second
     subject, and a course that teaches both at once teaches a student to
     guess which half of a rule is the one going wrong. Every question in
     all three banks now asks about ONE comparison, and no rule anywhere
     has two halves to it.

     THE HARD PART IS THE NUMBER ITSELF, and it is the same hard part in
     every one of the sixty. "More than 20" and "at least 20" agree on
     every reading in the world except 20, so a student who has never been
     asked about 20 has not met the difference between them. Nearly every
     question here sits exactly on a limit, or one step either side of it.

     THREE BANKS OF TWENTY, and the order across them is the lesson:

       KITCHEN  meet them. What does this symbol mean, what does this
                phrase mean, and does this reading pass?
       GAUGES   read them. Here are the readings that pass and the ones
                that do not — which rule is it?
       BELT     turn them round. What is the opposite of this rule, and
                which two of these three mean the same thing? */

  /* -------------------------------------------- ONE — ION'S KITCHEN */
  const KITCHEN = [
    { q:'Ion’s rule: cook when the pan is MORE THAN 200.\nThe pan reads 180.',
      ask:'Does he cook?',
      opts:['No','Yes'], a:0,
      why:'180 is below 200, so it is not <b>more than</b> 200.' },

    { q:'Ion’s rule: cook when the pan is MORE THAN 200.\nThe pan reads 240.',
      ask:'Does he cook?',
      opts:['Yes','No'], a:0,
      why:'240 is above 200, so the rule is satisfied and the pan is hot enough.' },

    { q:'Ion’s rule: cook when the pan is MORE THAN 200.\nThe pan reads 200.',
      ask:'Does he cook?',
      opts:['No','Yes'], a:0,
      why:'<b>More than 200</b> does not include 200 itself. 201 would do it.' },

    { q:'Ion’s rule: cook when the pan is AT LEAST 200.\nThe pan reads 200.',
      ask:'Does he cook?',
      opts:['Yes','No'], a:0,
      why:'<b>At least 200</b> does include 200. This is the whole difference from the last one.' },

    { q:'Which symbol means LESS THAN?',
      ask:'Pick one.',
      opts:['<','>','<='], a:0,
      why:'<b>&lt;</b> points at the smaller side.' },

    { q:'Which symbol means AT LEAST?',
      ask:'Pick one.',
      opts:['>=','>','=='], a:0,
      why:'<b>&gt;=</b> is "more than, or the same as". The line under it is the "or the same".' },

    { q:'Which symbol means AT MOST?',
      ask:'Pick one.',
      opts:['<=','<','!='], a:0,
      why:'<b>&lt;=</b> is "less than, or the same as".' },

    { q:'Which symbol means EXACTLY?',
      ask:'Pick one.',
      opts:['==','=','!='], a:0,
      why:'<b>==</b> asks a question. One <b>=</b> sets a value; two <b>==</b> ask whether they match.' },

    { q:'Which symbol means NOT THE SAME AS?',
      ask:'Pick one.',
      opts:['!=','==','<>'], a:0,
      why:'The <b>!</b> means "not", so <b>!=</b> is "not equal".' },

    { q:'Which symbol means MORE THAN?',
      ask:'Pick one.',
      opts:['>','>=','<'], a:0,
      why:'<b>&gt;</b> points at the smaller side, so the big number is on the left.' },

    { q:'The bowl has 3 spoons of batter.\nIon checks: batter != 0',
      ask:'Is that true?',
      opts:['True','False'], a:0,
      why:'3 is not the same as 0, so <b>!=</b> is true.' },

    { q:'The bowl is empty.\nIon checks: batter != 0',
      ask:'Is that true?',
      opts:['False','True'], a:0,
      why:'The batter IS 0, so "not the same as 0" is false.' },

    { q:'The timer reads 5.\nIon checks: timer <= 5',
      ask:'Is that true?',
      opts:['True','False'], a:0,
      why:'<b>&lt;=</b> includes the number itself.' },

    { q:'The timer reads 5.\nIon checks: timer < 5',
      ask:'Is that true?',
      opts:['False','True'], a:0,
      why:'<b>&lt;</b> does not include the number itself. 4 would be true.' },

    { q:'Ion waits until the timer reaches 0 — not 1, not −1.',
      ask:'Which symbol does he need?',
      opts:['timer == 0','timer <= 0','timer != 0'], a:0,
      why:'Exactly one reading passes, so it is <b>==</b>.' },

    { q:'Ion turns the pan off when it reaches 250.\n250 itself is hot enough.',
      ask:'Which symbol?',
      opts:['pan >= 250','pan > 250','pan == 250'], a:0,
      why:'"Reaches" includes the number, so <b>&gt;=</b>.' },

    { q:'The pan reads 99.\nIon checks: pan < 100',
      ask:'Is that true?',
      opts:['True','False'], a:0,
      why:'99 is below 100, so this is true. It does not have to be far below.' },

    { q:'The pan reads 100.\nIon checks: pan < 100',
      ask:'Is that true?',
      opts:['False','True'], a:0,
      why:'100 is not below 100. It is exactly 100.' },

    { q:'Which one is true when two numbers are the same?',
      ask:'Pick one.',
      opts:['==','!=','<'], a:0,
      why:'<b>==</b> is the only one that asks for a match.' },

    { q:'Which one is true when two numbers are different?',
      ask:'Pick one.',
      opts:['!=','==','>='], a:0,
      why:'<b>!=</b> is true whenever they do not match — bigger or smaller, it does not care.' }
  ];

  /* ------------------------------------------ TWO — THE SHIP'S GAUGES */
  const GAUGES = [
    { q:'Her rule: fuel must be AT LEAST 20.\nThe tank reads 20.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'<b>At least 20</b> includes 20 itself \u2014 it always means that number or more.' },

    { q:'Her rule: fuel must be AT LEAST 20.\nThe tank reads 19.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'19 is below the line, and the rule wants 20 or anything above it.' },

    { q:'Her rule: core heat must be UNDER 900.\nIt reads 900.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Under 900</b> does not include 900. 899 would have been fine.' },

    { q:'Her rule: the load must be AT MOST 400.\nThe hold reads 400.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'<b>At most 400</b> includes 400, unlike "under 400".' },

    { q:'Her rule: the pad must be WARMER THAN 0.\nIt reads 0.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Warmer than 0</b> means above it, and 0 is not above 0.' },

    { q:'A rule passes at 20. It fails at 19.',
      ask:'Which rule is it?',
      opts:['fuel >= 20','fuel > 20','fuel <= 20'], a:0,
      why:'It lets 20 through, so the number itself counts: <b>&gt;=</b>.' },

    { q:'A rule fails at 20. It passes at 21.',
      ask:'Which rule is it?',
      opts:['fuel > 20','fuel >= 20','fuel == 20'], a:0,
      why:'It refuses 20, so the number itself does not count: <b>&gt;</b>.' },

    { q:'A rule passes at 400. It fails at 401.',
      ask:'Which rule is it?',
      opts:['load <= 400','load < 400','load >= 400'], a:0,
      why:'It lets 400 through and nothing above it: <b>&lt;=</b>.' },

    { q:'A rule fails at 400. It passes at 399.',
      ask:'Which rule is it?',
      opts:['load < 400','load <= 400','load > 400'], a:0,
      why:'It refuses 400 itself, which <b>&lt;=</b> would have allowed.' },

    { q:'A rule passes at every reading except 180.',
      ask:'Which rule is it?',
      opts:['heading != 180','heading == 180','heading > 180'], a:0,
      why:'One reading refused, every other allowed: <b>!=</b>.' },

    { q:'"The key must be exactly 1."',
      ask:'Which symbol?',
      opts:['key == 1','key >= 1','key != 1'], a:0,
      why:'One reading allowed, every other refused.' },

    { q:'"Cabin air must be over 8."',
      ask:'Which symbol?',
      opts:['psi > 8','psi >= 8','psi < 8'], a:0,
      why:'<b>Over</b> never includes the number, so 8 itself fails.' },

    { q:'"Thrust must be AT MOST 80."',
      ask:'Which symbol?',
      opts:['thrust <= 80','thrust < 80','thrust >= 80'], a:0,
      why:'<b>At most</b> includes 80 itself, which is what the line under the <b>&lt;</b> is for.' },

    { q:'"Power must not be 0."',
      ask:'Which symbol?',
      opts:['power != 0','power == 0','power > 0'], a:0,
      why:'It refuses one reading. Note that <b>&gt; 0</b> would also refuse −5, which this rule allows.' },

    { q:'"The pad must be at least −5."',
      ask:'Which symbol?',
      opts:['pad >= -5','pad > -5','pad <= -5'], a:0,
      why:'<b>At least</b> is <b>&gt;=</b> whether the number is positive or not.' },

    { q:'Her rule: heat <= 899\nThe core reads 899.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'<b>&lt;=</b> includes 899. This is the same rule as "under 900" on whole numbers.' },

    { q:'Her rule: heat < 900\nThe core reads 899.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'899 is below 900. On whole numbers this rule and the last one agree everywhere.' },

    { q:'Her rule: fuel > 20\nThe tank reads 20.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'Exactly on the line, and <b>&gt;</b> wants above it.' },

    { q:'Her rule: fuel >= 20\nThe tank reads 20.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'The same reading, the other symbol, the other answer. This is the pair worth remembering.' },

    { q:'Which symbol lets the MOST readings through, on a gauge that runs 0 to 100?',
      ask:'Pick one.',
      opts:['fuel != 50','fuel >= 50','fuel == 50'], a:0,
      why:'<b>!=</b> refuses exactly one reading out of a hundred. The others refuse about half.' }
  ];

  /* ----------------------------------------------- THREE — THE BELT */
  const BELT = [
    { q:'A rule says: heat < 900',
      ask:'What is the opposite of that rule?',
      opts:['heat >= 900','heat > 900','heat <= 900'], a:0,
      why:'If it is not below 900 then it is 900 or above. The opposite of <b>&lt;</b> is <b>&gt;=</b>.' },

    { q:'A rule says: load > 400',
      ask:'What is the opposite?',
      opts:['load <= 400','load < 400','load >= 400'], a:0,
      why:'The opposite of <b>&gt;</b> is <b>&lt;=</b>. The number itself moves to the other side.' },

    { q:'A rule says: size == 6',
      ask:'What is the opposite?',
      opts:['size != 6','size > 6','size < 6'], a:0,
      why:'These two are a pair: one allows a single reading, the other refuses it.' },

    { q:'A rule says: weight != 12',
      ask:'What is the opposite?',
      opts:['weight == 12','weight > 12','weight <= 12'], a:0,
      why:'The opposite of "not that one" is "that one".' },

    { q:'A rule says: heat <= 300',
      ask:'What is the opposite?',
      opts:['heat > 300','heat >= 300','heat < 300'], a:0,
      why:'300 passes the first rule, so it must FAIL the opposite — which rules out <b>&gt;=</b>.' },

    { q:'The arm takes a part when: load < 200\nA part reads 200.',
      ask:'Taken?',
      opts:['Left','Taken'], a:0,
      why:'200 is not below 200 \u2014 it is exactly 200, which <b>&lt;</b> refuses.' },

    { q:'The arm takes a part when: load <= 200\nA part reads 200.',
      ask:'Taken?',
      opts:['Taken','Left'], a:0,
      why:'The same reading, one symbol different, the other answer.' },

    { q:'Two rules, on whole numbers:\n  heat < 900\n  heat <= 899',
      ask:'Do they take the same parts?',
      opts:['Yes','No'], a:0,
      why:'On whole numbers, "below 900" and "899 or less" allow exactly the same readings.' },

    { q:'Two rules: heat < 900, heat <= 900.',
      ask:'Do they take the same parts?',
      opts:['No','Yes'], a:0,
      why:'They disagree on exactly one reading: 900 itself.' },

    { q:'Two rules: size > 5, size >= 6, on whole numbers.',
      ask:'Do they take the same parts?',
      opts:['Yes','No'], a:0,
      why:'The first whole number above 5 is 6, so both rules start there.' },

    { q:'The belt should take every part EXCEPT the ones reading 7.',
      ask:'Which rule?',
      opts:['size != 7','size == 7','size > 7'], a:0,
      why:'One reading refused, all others allowed.' },

    { q:'The belt should take ONLY the parts reading 7.',
      ask:'Which rule?',
      opts:['size == 7','size != 7','size >= 7'], a:0,
      why:'One reading allowed, all others refused. The pair to the last one.' },

    { q:'A rule takes parts reading 0, 1, 2, 3.\nIt leaves 4.',
      ask:'Which rule?',
      opts:['size <= 3','size < 3','size <= 4'], a:0,
      why:'3 is taken, so the number itself counts: <b>&lt;=</b> 3.' },

    { q:'A rule takes parts reading 4, 5, 6.\nIt leaves 3.',
      ask:'Which rule?',
      opts:['size >= 4','size > 4','size >= 3'], a:0,
      why:'4 is taken, so the line is at 4 and the number itself counts.' },

    { q:'heat >= 900 is FALSE for a part.',
      ask:'What do you know about its heat?',
      opts:['It is below 900','It is 900','It is above 900'], a:0,
      why:'If it is not "900 or more", the only thing left is below 900.' },

    { q:'load != 50 is FALSE for a part.',
      ask:'What do you know about its load?',
      opts:['It is exactly 50','It is above 50','It is below 50'], a:0,
      why:'"Not 50" being false leaves only one reading it can be.' },

    { q:'A gauge reads −3. The rule is: temp > -5',
      ask:'Does it pass?',
      opts:['Yes','No'], a:0,
      why:'−3 is warmer than −5. Further from zero is not the same as bigger.' },

    { q:'A gauge reads −7. The rule is: temp > -5',
      ask:'Does it pass?',
      opts:['No','Yes'], a:0,
      why:'−7 is colder than −5, so it is below the line.' },

    { q:'Which rule refuses the FEWEST parts, on a gauge that runs 0 to 100?',
      ask:'Pick one.',
      opts:['size != 40','size <= 40','size == 40'], a:0,
      why:'<b>!=</b> refuses exactly one reading. <b>==</b> refuses ninety-nine of them.' },

    { q:'A rule passes at 10. It passes at 11. It fails at 9.',
      ask:'Which rule is it?',
      opts:['size >= 10','size > 10','size == 10'], a:0,
      why:'10 passes and 9 does not, so the line is at 10 and 10 itself counts.' }
  ];

  const BANKS = { kitchen:KITCHEN, gauges:GAUGES, belt:BELT };
  let QUESTIONS = KITCHEN;

  /* --------------------------------------------------------- the state
     `queue` is which questions are still owed, in order. A wrong answer
     puts the question back on the end rather than stopping anybody, so
     the round ends when all twenty are known and not when all twenty have
     been seen. `firstTry` is the score worth reporting. */
  /* AND THE OPTIONS ARE SHUFFLED, WHICH IS NOT A FLOURISH.

     Every question in both banks is written with its right answer first,
     because that is the only sane way to write forty of them and keep
     them readable. Shown in that order it is not a quiz: click the top
     one forty times and you are through, having read nothing. Somebody
     spotted that in about a minute, which is roughly how long it would
     take a class.

     So each question gets its own permutation when the round starts, and
     everything downstream — which option was clicked, which are struck
     out, which one lights up green — is in DISPLAY order. `a` stays where
     the author put it and is mapped through the shuffle at the one place
     it is compared. Re-shuffled on every start(), so a second attempt is
     not the first one with the positions memorised. */
  function shuffle(n){
    const o=[]; for(let i=0;i<n;i++) o.push(i);
    for(let i=n-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));
                            const t=o[i]; o[i]=o[j]; o[j]=t; }
    return o;
  }
  function start(){
    return { queue: QUESTIONS.map((q,i)=>i),
             shuf:  QUESTIONS.map(q=>shuffle(q.opts.length)),
             at:0, picked:null, wrong:[], firstTry:0, seen:{} };
  }
  const current = s => QUESTIONS[s.queue[s.at]];
  const done    = s => s.at >= s.queue.length;
  /* The question as it is on screen: its options in this round's order,
     and where the right one has landed in that order. */
  function shown(s){
    const idx=s.queue[s.at], q=QUESTIONS[idx];
    if(!q) return null;
    const perm=(s.shuf && s.shuf[idx]) || q.opts.map((o,i)=>i);
    return { q, idx, perm,
             opts: perm.map(i=>q.opts[i]),
             a:    perm.indexOf(q.a) };
  }

  /* ANSWERING, AND A WRONG ONE IS A TRY AGAIN.

     It used to reveal the right answer beside the wrong one and move on,
     with the question re-queued for the end. That is a fair way to mark a
     test and a poor way to teach: the moment somebody is most willing to
     think about `and` versus `or` is the second after getting it wrong,
     and being shown the answer is precisely what removes the reason to.

     So a wrong answer is struck out and the question stays. `wrong` is
     the set of options already ruled out — struck through and dead, so
     nobody can click the same one twice and nobody is made to re-read
     what they have already eliminated — and the question is not over
     until it is right.

     THE SCORE IS STILL FIRST ATTEMPTS. `seen[idx]` is written once, on
     the first answer to a question, so a student who gets there on the
     third go has learned it and knows they took three. */
  /* `i` IS A DISPLAY INDEX. It is what the student clicked, which after
     the shuffle is not what the author wrote. */
  function answer(s, i){
    if(done(s) || s.picked!==null) return s;
    /* AND A STRUCK-OUT OPTION IS DEAD. The panel disables the button, so
       this cannot be reached by clicking — but a rule enforced only by a
       disabled attribute is a rule that holds until somebody adds a
       keyboard shortcut. Ruling the same option out twice would also put
       it in the list twice. */
    if((s.wrong||[]).indexOf(i)>=0) return s;
    const v=shown(s);
    if(!v) return s;
    const idx=v.idx;
    const right = i===v.a;
    const out=Object.assign({}, s);
    out.seen=Object.assign({}, s.seen);
    if(out.seen[idx]===undefined){
      out.seen[idx]=right;
      if(right) out.firstTry=s.firstTry+1;
    }
    if(right){
      out.picked=i;
      out.wrong=[];
    } else {
      out.picked=null;                       // still their turn
      out.wrong=(s.wrong||[]).concat([i]);
    }
    return out;
  }

  /* On to the next. Nothing is re-queued any more, because nothing is
     left behind: a question is not finished until it is answered. */
  function next(s){
    return Object.assign({}, s, { picked:null, wrong:[], at:s.at+1 });
  }

  const API = { BANKS, start, current, shown, done, answer, next,
                get QUESTIONS(){ return QUESTIONS; },
                get length(){ return QUESTIONS.length; } };

  /* ==================================================== THE PANEL
     Only ever touched from open(), so this file can be required by the
     tests without a document anywhere near it. */
  let ui=null, state=null, onDone=null;
  const $  = (sel, el) => (el||document).querySelector(sel);
  const esc = x => String(x).replace(/[&<>"]/g,
    c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const say = (s,p) => (typeof root.t==='function' ? root.t(s,p) : s);

  function dom(){
    if(ui && ui.el && ui.el.parentNode) return ui;
    const el=document.createElement('div');
    el.id='bqwrap';
    el.innerHTML=`
      <style>
      #bqwrap{position:fixed;inset:0;z-index:70;display:flex;
              align-items:center;justify-content:center;
              background:rgba(6,4,14,.62);font-family:inherit}
      #bq{width:min(680px,94vw);max-height:92vh;overflow:auto;
          background:#161129;border:1px solid #3a2f5c;border-radius:18px;
          box-shadow:0 24px 70px rgba(0,0,0,.55);color:#e9e4ff}
      #bqhead{display:flex;align-items:center;justify-content:space-between;
              padding:14px 20px;border-bottom:1px solid #2c2448;
              font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;
              color:#ffd98a;text-transform:uppercase}
      #bqdots{display:flex;gap:5px}
      #bqdots i{width:7px;height:7px;border-radius:50%;background:#3a2f5c;
                display:block;transition:background .2s}
      #bqdots i.on{background:#ffd98a}
      #bqdots i.bad{background:#e0736f}
      #bqbody{padding:22px 24px 6px}
      .bqq{font-size:19px;line-height:1.5;white-space:pre-line;margin:0 0 4px}
      .bqask{font-size:14px;color:#a79ecd;margin:10px 0 16px}
      .bqopts{display:flex;flex-direction:column;gap:9px}
      .bqo{text-align:left;padding:13px 16px;border-radius:12px;
           border:2px solid #3a2f5c;background:#1d1735;color:#e9e4ff;
           font:inherit;font-size:16px;cursor:pointer;transition:.15s}
      .bqo:hover:enabled{border-color:#8fd6c0}
      .bqo.right{border-color:#79d6a8;background:#1b3328;color:#d8ffe9}
      .bqo.wrong{border-color:#e0736f;background:#33191d;color:#ffd9d6}
      .bqo:disabled{cursor:default}
      .bqop{font-style:normal;font-weight:700;color:#7ff0d2;letter-spacing:.02em}
      .bqo.wrong .bqop{color:inherit}
      .bqo.wrong{text-decoration:line-through;opacity:.5}
      .bqwhy.try{background:#33232c;border-color:#6d4353;color:#ffd6dd}
      .bqwhy{margin:16px 0 4px;padding:13px 16px;border-radius:12px;
             background:#1a2438;border:1px solid #2f3f5f;
             font-size:15px;line-height:1.5;color:#cfe4ff}
      .bqwhy b{color:#ffd98a}
      #bqfoot{display:flex;align-items:center;justify-content:space-between;
              gap:12px;padding:14px 22px 20px}
      #bqscore{font:12px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;
               color:#7d74a8}
      #bqgo{padding:11px 22px;border-radius:11px;border:0;cursor:pointer;
            background:#ffd98a;color:#241a05;font:inherit;font-weight:700}
      #bqgo.gone{visibility:hidden}
      </style>
      <div id="bq">
        <div id="bqhead"><span>${HEAD}</span>
          <span id="bqdots"></span></div>
        <div id="bqbody"></div>
        <div id="bqfoot"><span id="bqscore"></span>
          <button id="bqgo" class="gone">${say('NEXT')} →</button></div>
      </div>`;
    document.body.appendChild(el);
    ui={ el, body:$('#bqbody',el), dots:$('#bqdots',el),
         go:$('#bqgo',el), score:$('#bqscore',el) };
    ui.go.onclick=()=>{
      if(done(state)) return finish();
      state=next(state);
      if(done(state)) return finish();
      draw();
    };
    return ui;
  }

  /* THE THREE WORDS, IN THEIR OWN COLOUR, everywhere they appear.

     `and`, `or` and `not` are the whole subject, and in a wall of plain
     English they are three more words the same colour as the rest of the
     sentence. Marked up they stop being prose and start being operators,
     which is the thing the student is meant to be looking at. Case is
     kept — the questions say AND inside a quoted rule and `and` in an
     answer, and both of those are deliberate.

     AFTER ESCAPING, ALWAYS. This runs over text that has already been
     made safe, so the tags it adds are the only tags in it. The other way
     round would let a question's own words become markup. */
  /* THE SIX SYMBOLS AND THE WORDS FOR THEM, coloured wherever they
     appear. They are the entire subject, and in a wall of plain English
     the phrase that decides the answer is three more words the same
     colour as the rest of the sentence.

     LONGEST FIRST, in one alternation and one pass. "at least" contains
     "at"; "not the same as" contains "not"; and a shorter alternative
     matching first would colour half a phrase and leave the rest as
     prose. The symbols go first of all, because `<=` contains `<`. */
  const OPS = [
    '&lt;=','&gt;=','!=','==','&lt;','&gt;','<=','>=','<','>',
    'AT LEAST','AT MOST','NOT THE SAME AS','MORE THAN','LESS THAN',
    'WARMER THAN','EXACTLY','UNDER','OVER',
    'at least','at most','not the same as','more than','less than',
    'warmer than','exactly','under','over'
  ];
  const esc_ = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const OPRE = new RegExp('(' + OPS.map(esc_).join('|') + ')', 'g');
  const opWord = html => html.replace(OPRE, '<em class="bqop">$1</em>');

  function draw(){
    const u=dom(), v=shown(state);
    if(!v) return finish();
    /* EVERYTHING HERE IS IN DISPLAY ORDER — the options, which one is
       struck out, and which one lights up green. `v.a` is where the
       author's right answer landed in this round's shuffle. */
    const q=v.q, picked=state.picked, struck=state.wrong||[];
    u.body.innerHTML =
      `<p class="bqq">${opWord(esc(q.q))}</p>`
    + `<p class="bqask">${opWord(esc(q.ask))}</p>`
    + `<div class="bqopts">` + v.opts.map((o,i)=>{
        let cls='bqo';
        const dead = struck.indexOf(i)>=0;
        if(picked!==null && i===v.a) cls+=' right';
        else if(dead) cls+=' wrong';
        const off = picked!==null || dead;
        return `<button class="${cls}" data-i="${i}"${off?' disabled':''}>`
             + `${opWord(esc(o))}</button>`;
      }).join('') + `</div>`
    /* THE REASON ON THE WAY OUT, AND A NUDGE ON THE WAY BACK. Showing the
       explanation on a wrong answer would be showing the answer, which is
       the whole of why it does not move on. */
    + (picked!==null ? `<div class="bqwhy">${opWord(q.why)}</div>`
       : struck.length ? `<div class="bqwhy try">${say('Not that one. Read it again and try another.')}</div>`
       : '');

    u.body.querySelectorAll('[data-i]:not([disabled])').forEach(b=>{
      b.onclick=()=>{ state=answer(state, +b.dataset.i); draw(); };
    });

    /* One dot per question in the round, so twenty is visibly twenty. */
    /* A DOT PER QUESTION: lit when it was got first time, amber when it
       took more than one go, empty until it has been answered at all. */
    u.dots.innerHTML = state.queue.map((idx,i)=>{
      const got=state.seen[idx];
      const past = i<state.at || (i===state.at && state.picked!==null);
      return `<i class="${past ? (got ? 'on' : 'bad') : ''}"></i>`;
    }).join('');

    const n=Object.keys(state.seen).length;
    u.score.textContent = say('{a} of {b}', { a:n, b:QUESTIONS.length });
    u.go.classList.toggle('gone', state.picked===null);
    const last = state.at===state.queue.length-1;
    u.go.textContent = last ? say('DONE') : say('NEXT') + ' →';
  }

  function finish(){
    const score=state ? state.firstTry : 0;
    close();
    const cb=onDone; onDone=null;
    if(cb) cb(score, QUESTIONS.length);
  }
  function close(){
    if(ui && ui.el && ui.el.parentNode) ui.el.parentNode.removeChild(ui.el);
    ui=null;
    hideCoach(false);
    if(root.G) root.G.running=true;
  }
  /* The card, its ring and its beacon are three separate elements COACH
     hangs off the body; all three belong to the same sentence. */
  function hideCoach(off){
    ['#coachTip','#coachRing','#coachBeacon'].forEach(sel=>{
      const e=document.querySelector(sel);
      if(e) e.style.display = off ? 'none' : '';
    });
  }

  let HEAD='';
  function open(opts){
    opts=opts||{};
    /* WHICH TWENTY. The Mechanic asks about joining facts; the ship asks
       about where one fact stops. Same panel, same try-again, same dots. */
    QUESTIONS = BANKS[opts.bank] || KITCHEN;
    const HEADS={ kitchen: say('ION') + ' · ' + say('HIS MORNING RULES'),
                  gauges:  say('E-45') + ' · ' + say('HER SAFETY RULES'),
                  belt:    say('THE MECHANIC') + ' · ' + say('THE BELT') };
    HEAD = opts.title || HEADS[opts.bank] || HEADS.kitchen;
    onDone=opts.onDone||null;
    state=start();
    if(root.G) root.G.running=false;
    /* THE WALKTHROUGH CARD GOES AWAY WHILE THIS IS UP.

       It sits in the bottom middle of the screen and it is pointing at
       the thing that is now open in front of it — "the lit panel on her
       flank is the pre-flight", with the pre-flight covering half of it.
       Two sets of instructions on screen at once, one of them about how
       to reach the other, is one set too many; and the walkthrough has
       nothing to say about a question that is being asked right now.

       HIDDEN, NOT STOPPED. Its step is still live underneath, so closing
       the panel half way through puts the card back exactly where it was
       rather than dropping somebody who was following it. */
    hideCoach(true);
    /* A PANEL LEFT OVER FROM THE OTHER BANK would keep the other bank's
       heading and the other bank's row of dots. */
    if(ui && ui.el && ui.el.parentNode) ui.el.parentNode.removeChild(ui.el);
    ui=null;
    dom(); draw();
  }

  API.open=open; API.close=close;
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.BOOLQUIZ=API;
})(typeof self!=='undefined' ? self : this);
