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
  const AND_OR_NOT = [
    /* ------------------------------------------- what the words mean */
    { q:'You may go in if you have a ticket AND you are on the list.\n'
       +'You have a ticket. You are not on the list.',
      ask:'May you go in?',
      opts:['No','Yes','Only if you ask'], a:0,
      why:'<b>and</b> needs both sides to be true. One of them is false, so the whole thing is false.' },

    { q:'You may go in if you have a ticket OR you are on the list.\n'
       +'You have a ticket. You are not on the list.',
      ask:'May you go in?',
      opts:['Yes','No','Only with both'], a:0,
      why:'<b>or</b> only needs one side. The ticket is enough on its own.' },

    { q:'Which word is true only when BOTH parts are true?',
      ask:'Pick one.',
      opts:['and','or','not'], a:0,
      why:'<b>and</b> is the strict one. Both, or nothing.' },

    { q:'Which word is true when AT LEAST ONE part is true?',
      ask:'Pick one.',
      opts:['or','and','not'], a:0,
      why:'<b>or</b> is the generous one. One is enough, and both is fine too.' },

    { q:'It is NOT raining.',
      ask:'So "it is raining" is...',
      opts:['false','true'], a:0,
      why:'<b>not</b> flips it. If it is not raining, then "it is raining" is false.' },

    /* ------------------------------------------------ working them out */
    { q:'true AND false',
      ask:'What is it?',
      opts:['false','true'], a:0,
      why:'One side is false, and <b>and</b> wants both.' },

    { q:'true OR false',
      ask:'What is it?',
      opts:['true','false'], a:0,
      why:'One side is true, and <b>or</b> only needs one.' },

    { q:'false OR false',
      ask:'What is it?',
      opts:['false','true'], a:0,
      why:'<b>or</b> needs at least one true side. Neither of these is.' },

    { q:'NOT false',
      ask:'What is it?',
      opts:['true','false'], a:0,
      why:'<b>not</b> flips it, so the opposite of false is true.' },

    { q:'true AND true AND false',
      ask:'What is it?',
      opts:['false','true'], a:0,
      why:'One false anywhere in a chain of <b>and</b>s makes the whole chain false.' },

    /* ------------------------------------------- reading somebody’s rule */
    { q:'The rule: take a part if it is cool AND not cracked.\n'
       +'This part is cool. It is cracked.',
      ask:'Take it?',
      opts:['Leave it','Take it'], a:0,
      why:'It passes "cool" and fails "not cracked". <b>and</b> needs both.' },

    { q:'The rule: take a part if it is light OR cool.\n'
       +'This part is heavy. It is cool.',
      ask:'Take it?',
      opts:['Take it','Leave it'], a:0,
      why:'It fails "light" but passes "cool", and <b>or</b> only needs one.' },

    { q:'The rule: leave the cracked ones, and leave the hot ones.\n'
       +'This part is cool and whole.',
      ask:'What happens to it?',
      opts:['It is taken','It is left'], a:0,
      why:'It is neither cracked nor hot, so neither reason to leave it applies.' },

    { q:'The rule: anything hot must be whole.\n'
       +'This part is cold, and it is cracked.',
      ask:'Does it break the rule?',
      opts:['No','Yes'], a:0,
      why:'The rule only says something about HOT things. A cold part is nobody’s business.' },

    { q:'The rule: anything hot must be whole.\n'
       +'This part is hot, and it is cracked.',
      ask:'Does it break the rule?',
      opts:['Yes','No'], a:0,
      why:'It is hot, so the rule applies to it — and it is not whole.' },

    /* -------------------------------------- turning a rule inside out */
    { q:'"It is NOT (hot AND cracked)."',
      ask:'Which one means the same thing?',
      opts:['not hot OR not cracked',
            'not hot AND not cracked',
            'hot OR cracked'], a:0,
      why:'Flip both sides AND change the join. "Not both" means at least one of them is fine.' },

    { q:'"It is NOT (hot OR cracked)."',
      ask:'Which one means the same thing?',
      opts:['not hot AND not cracked',
            'not hot OR not cracked',
            'hot AND cracked'], a:0,
      why:'Both sides flip and the join changes again — this time <b>or</b> becomes <b>and</b>.' },

    { q:'Both lights are on.',
      ask:'What is the opposite of that?',
      opts:['At least one light is off',
            'Both lights are off',
            'One light is on'], a:0,
      why:'The opposite of "both" is not "neither". One being off is enough to spoil it.' },

    { q:'At least one door is open.',
      ask:'What is the opposite of that?',
      opts:['Every door is shut',
            'At least one door is shut',
            'One door is open'], a:0,
      why:'The opposite of "at least one" is "none at all".' },

    { q:'"If it is hot, it must be whole."',
      ask:'Which one means the same thing?',
      opts:['It is not hot, OR it is whole',
            'It is hot AND it is whole',
            'It is not hot AND it is whole'], a:0,
      why:'A rule about hot things says nothing about cold ones. '
        +'So: cold is always fine, and hot is fine only when whole.' }
  ];

  /* ================================================ THE OTHER TWENTY
     THE E-45'S SAFETY RULES, which is a different subject in the same
     shape. `and`, `or` and `not` join two facts together; these twenty
     are about where ONE fact stops — at least, at most, under, over,
     exactly, anything but.

     THE BOUNDARY IS THE WHOLE LESSON. "At least 20" and "more than 20"
     are the same rule on every reading except 20 itself, and a student
     who has never been asked about 20 has not met the difference. Nearly
     every question here sits exactly on a limit or one step either side
     of it, because that is the only place the words come apart.

     It is her own gauges throughout — fuel, core heat, load, the pad, the
     key, the heading — so the rules being read are the rules that were on
     the panel, and the last five join two of them with the `and` and `or`
     from the other bank. */
  const COMPARE = [
    /* ------------------------------------------ sitting on the limit */
    { q:'Her rule: fuel must be AT LEAST 20.\nThe tank reads 20.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'<b>At least 20</b> includes 20. "At least" means that number or more.' },

    { q:'Her rule: fuel must be AT LEAST 20.\nThe tank reads 19.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'19 is below 20, and the rule wants 20 or more.' },

    { q:'Her rule: core heat must be UNDER 900.\nIt reads 900.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Under 900</b> does not include 900. 899 would have been fine.' },

    { q:'Her rule: the load must be 400 OR LESS.\nThe hold reads 400.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'<b>400 or less</b> includes 400 \u2014 unlike "under 400", which does not.' },

    { q:'Her rule: the pad must be WARMER THAN 0.\nIt reads 0.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Warmer than 0</b> means above it, and 0 is not above 0.' },

    /* ---------------------------------------- what the words include */
    { q:'"At least 20"',
      ask:'Which readings pass?',
      opts:['20, and anything above it','anything above 20','anything below 20'], a:0,
      why:'<b>At least</b> always includes the number itself.' },

    { q:'"More than 20"',
      ask:'Which readings pass?',
      opts:['anything above 20','20, and anything above it','20 exactly'], a:0,
      why:'<b>More than</b> never includes the number itself, so 20 fails.' },

    { q:'"At most 400" lets 400 through.',
      ask:'True or false?',
      opts:['True','False'], a:0,
      why:'<b>At most</b> is the same shape as "at least": the number itself counts.' },

    { q:'"Under 900" lets 900 through.',
      ask:'True or false?',
      opts:['False','True'], a:0,
      why:'<b>Under</b> is the same shape as "more than": the number itself does not.' },

    { q:'Her rule: the key must be EXACTLY 1.\nIt reads 2.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Exactly</b> allows one reading and no other. Not 0, not 2.' },

    /* ------------------------------ working the rule out from a gauge */
    { q:'A rule passes at 20 and fails at 19.',
      ask:'Which rule is it?',
      opts:['at least 20','more than 20','at most 20'], a:0,
      why:'It lets 20 through, so the number itself counts: <b>at least</b>.' },

    { q:'A rule fails at 20 and passes at 21.',
      ask:'Which rule is it?',
      opts:['more than 20','at least 20','at most 20'], a:0,
      why:'It refuses 20, so the number itself does not count: <b>more than</b>.' },

    { q:'A rule passes at 400 and fails at 401.',
      ask:'Which rule is it?',
      opts:['at most 400','under 400','at least 400'], a:0,
      why:'It lets 400 through and nothing above it: <b>at most</b>.' },

    { q:'A rule fails at 400 and passes at 399.',
      ask:'Which rule is it?',
      opts:['under 400','at most 400','more than 400'], a:0,
      why:'It refuses 400 itself, which "at most 400" would have allowed.' },

    { q:'Her rule: the heading must be ANYTHING BUT 180.\nIt reads 180.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Anything but</b> refuses one reading and allows every other one.' },

    /* --------------------------------------------- two rules at once */
    { q:'Her rule: cabin air must be OVER 8 AND UNDER 40.\nIt reads 8.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'<b>Over 8</b> does not include 8, and <b>and</b> needs both sides.' },

    { q:'Her rule: cabin air must be OVER 8 AND UNDER 40.\nIt reads 39.',
      ask:'May she fly?',
      opts:['Yes','No'], a:0,
      why:'39 is above 8 and below 40, so both sides are true.' },

    { q:'Her rule: power must be AT LEAST 50 AND NOT leaking.\n'
       +'Power reads 80. It is leaking.',
      ask:'May she fly?',
      opts:['No','Yes'], a:0,
      why:'The power is fine and the leak is not, and <b>and</b> needs both.' },

    { q:'Her rule: she may launch if fuel is AT LEAST 20 OR the tank is full.\n'
       +'Fuel reads 12. The tank is not full.',
      ask:'May she launch?',
      opts:['No','Yes'], a:0,
      why:'<b>or</b> needs one side to be true, and neither of these is.' },

    { q:'Her rule: anything OVER 900 must be shut down.\nThe core reads 900.',
      ask:'Shut it down?',
      opts:['No','Yes'], a:0,
      why:'900 is not <b>over</b> 900, so the rule does not reach it. One step further and it would.' }
  ];

  const BANKS = { bool:AND_OR_NOT, compare:COMPARE };
  let QUESTIONS = AND_OR_NOT;

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
  const OPS = [
    /* LONGEST FIRST, in one alternation and one pass. "or less" contains
       "or", and a shorter alternative that matches first would colour the
       "or" and leave "less" as prose — turning a limit into a join, which
       is precisely the confusion this is meant to prevent. */
    'AT LEAST','AT MOST','ANYTHING BUT','MORE THAN','WARMER THAN','OR LESS',
    'at least','at most','anything but','more than','warmer than','or less',
    'UNDER','OVER','EXACTLY','under','over','exactly',
    'AND','OR','NOT','and','or','not'
  ];
  const OPRE = new RegExp('\\b(' + OPS.join('|') + ')\\b', 'g');
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
    QUESTIONS = BANKS[opts.bank] || AND_OR_NOT;
    HEAD = opts.title || (opts.bank==='compare'
      ? say('E-45') + ' · ' + say('HER SAFETY RULES')
      : say('THE MECHANIC') + ' · ' + say('AND, OR, NOT'));
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
