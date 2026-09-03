/* =====================================================================
   QUIZ + CERT — a short check after every mission.

   Finishing the gunfight (or the corridor, or the vault) proves you can
   click RUN at the right moment. The quiz asks the same question a
   different way — no gun, no clock, just "why did that work?" — and the
   certificate is the receipt: your name, the concept, the score, the date.

   PASS is a real gate: score under it and you retake the quiz instead of
   walking away with a certificate that overstates what you know. Passing
   never touches PROGRESS.complete() — that still belongs to beating the
   mission — so a halfway skip earns a certificate without unlocking the
   next mission early.
   ===================================================================== */
window.QUIZ = (function(){
  const PASS = 70;

  const BANKS = {
    nav: { topic:'Commands & Loops', mission:'Escape — Corridors', questions:[
      { q:'What does <b>forward()</b> do?',
        a:['Turns you a quarter turn','Moves you one tile the way you are facing','Ends the program early','Repeats the next block'], correct:1 },
      { q:'Why write <b>repeat 10</b> instead of ten separate forward() blocks?',
        a:['It moves you further per step','Same result, far less to write — and one number to change','It automatically dodges walls','It turns the program invisible'], correct:1 },
      { q:'The computer runs your blocks…',
        a:['In a random order each time','All at once','Top to bottom, in order','Bottom to top'], correct:2 },
      { q:'<b>left()</b> and <b>right()</b> do what to your position on the grid?',
        a:['Move you one tile sideways','Nothing — they only turn you in place','Move you backward','Delete the next block'], correct:1 }
    ]},
    race: { topic:'Loops inside loops', mission:'Circuit — Time Trial', questions:[
      { q:'Each <b>gas()</b> in an unbroken row is quicker than the one before. What does a <b>turn</b> do to that speed?',
        a:['Nothing, speed carries through a turn','Drops you back to a standing start','Doubles it','Ends the program'], correct:1 },
      { q:'Why is a long straight taken in <b>one repeat</b> faster than the same tiles split by an extra turn?',
        a:['The repeat block runs at double speed','The straight never breaks, so speed keeps building','Turns are free','It is not faster, only shorter'], correct:1 },
      { q:'A lap is <b>repeat 8 { gas() } turnLeft()</b> done four times. What is the shortest way to write three of those laps?',
        a:['Write the lap out three times','Wrap the whole lap in one more repeat','Use a bigger number inside gas()','Turn three extra times'], correct:1 },
      { q:'A square circuit with four identical sides takes 36 blocks written out flat, or 4 blocks nested. Why is nesting also <b>faster</b>, not just shorter?',
        a:['Nested blocks execute quicker','It does not add turns the track never asked for','Loops skip tiles','The timer pauses inside a loop'], correct:1 }
    ]},
    m1: { topic:'Loops', mission:'Mission 1 — Loops', questions:[
      { q:'A <b>repeat 3</b> block runs the blocks inside it…',
        a:['Once','Three times','Zero times','Until you click Stop'], correct:1 },
      { q:'Why did <b>repeat</b> beat writing shoot() three times in a row?',
        a:['It deals extra damage per shot','Same result with less code — and one number changes how much it does','It aims for you automatically','It only works on bosses'], correct:1 },
      { q:'THE LOOPER regrows his shield after every program runs. What does that force you to do?',
        a:['Fire every shot inside one repeat, in a single run','Wait longer between programs','Only ever use single shoot() commands','Avoid the repeat block entirely'], correct:0 },
      { q:'A shield has 8 parts. Which program clears it in one run?',
        a:['repeat 4 { shoot() }','repeat 8 { shoot() }','shoot() by itself','repeat 8 { repeat 8 { shoot() } }'], correct:1 }
    ]},
    m2: { topic:'Choices (if / else)', mission:'Mission 2 — Choices', questions:[
      { q:'An <b>if</b> block runs the code inside it…',
        a:['Every time, no matter what','Only when its condition is true','Only once per mission','Only when you hold Shift'], correct:1 },
      { q:'A drone has a red shield. What happens if you shootBlue() at it?',
        a:['It works anyway','Nothing breaks — the colour has to match','It breaks twice as fast','The shield turns red'], correct:1 },
      { q:'PRISM changes colour every two seconds. Why does a fixed, one-colour program fail?',
        a:['It fires too slowly to matter','It never re-checks the colour — only if/else looks again each time','PRISM is invisible half the time','Fixed programs cannot use repeat'], correct:1 },
      { q:'Putting an <b>if</b> block inside a <b>repeat</b> lets you…',
        a:['Check the condition fresh on every pass through the loop','Skip the condition entirely','Turn the if block off','Run the loop exactly once'], correct:0 }
    ]},
    m3: { topic:'Functions', mission:'Mission 3 — Functions', questions:[
      { q:'A function — <b>define combo()</b> — lets you…',
        a:['Delete blocks you no longer need','Name a group of blocks once and reuse it with a single call','Make the game run faster','Turn off loops'], correct:1 },
      { q:'You define combo() with shootRed() then shootBlue() inside it. Calling combo() once runs…',
        a:['Nothing until RUN is pressed twice','Both shots, in the order you defined them','Only the first shot','A random one of the two'], correct:1 },
      { q:'OFF-BY-ONE always has one more shield part than he shows. What is that testing?',
        a:['Loops','Careful counting — code often starts counting at zero','Colour matching','Nothing — it is just flavour'], correct:1 },
      { q:'Calling your function inside a <b>repeat</b> lets you…',
        a:['Run the named combo more than once without rewriting it','Delete the function after one use','Make the function run backward','Turn the function into a loop permanently'], correct:0 }
    ]},
    puzzles: { topic:'Loops and counting', mission:'Covert Ops', questions:[
      { q:'Each <b>turn()</b> swings the camera…',
        a:['A quarter turn','All the way around','Nowhere — it only tilts','Back to its start, instantly'], correct:0 },
      { q:'Why did the fix need exactly 2 turns and 3 holds — not some other numbers?',
        a:['Any numbers work the same','It has to end facing the wall and then stay there — the count is the whole plan','hold() also turns the camera','It is just decoration'], correct:1 },
      { q:'If the camera swings back after you turn it, what is missing from the program?',
        a:['More turn() blocks','hold() blocks to keep it parked in place','A repeat around nothing','Nothing — it corrects itself'], correct:1 }
    ]}
  };

  let S=null;

  function start(missionId, opts){
    opts=opts||{};
    const bank = BANKS[missionId] || BANKS.m1;
    S = { missionId, bank, i:0, correct:0, opts };
    document.querySelector('#cert').classList.add('hidden');
    document.querySelector('#quiz').classList.remove('hidden');
    render();
  }

  function render(){
    const el=document.querySelector('#quiz'); if(!el) return;
    const total=S.bank.questions.length;
    if(S.i>=total){ grade(); return; }
    const q=S.bank.questions[S.i];
    el.innerHTML=`<div class="card" style="max-width:640px;text-align:left">
      <div class="kicker">${t('QUIZ')} · ${t(S.bank.topic)}</div>
      <h1 style="margin-top:6px">${t('Question {n} of {t}',{n:S.i+1,t:total})}</h1>
      <p style="font-size:19px">${t(q.q)}</p>
      <div id="qOpts" style="display:grid;gap:10px;margin-top:14px"></div>
    </div>`;
    const wrap=el.querySelector('#qOpts');
    q.a.forEach((txt,idx)=>{
      const b=document.createElement('button');
      b.className='btn ghost';
      b.innerHTML=t(txt);
      b.onclick=()=>choose(idx);
      wrap.appendChild(b);
    });
  }

  function choose(idx){
    const q=S.bank.questions[S.i];
    const ok = idx===q.correct;
    if(ok) S.correct++;
    if(window.beep) beep(ok?'star':'bad');
    const btns=[...document.querySelectorAll('#qOpts button')];
    btns.forEach((b,i)=>{
      b.disabled=true;
      if(i===q.correct) b.style.outline='3px solid var(--good)';
      else if(i===idx) b.style.outline='3px solid var(--bad)';
    });
    setTimeout(()=>{ S.i++; render(); }, 750);
  }

  function grade(){
    const total=S.bank.questions.length;
    const pct=Math.round(S.correct/total*100);
    if(window.PROGRESS && PROGRESS.recordQuiz) PROGRESS.recordQuiz(S.missionId, pct);
    if(pct>=PASS) CERT.show(S.missionId, pct, S.opts);
    else failScreen(pct);
  }

  function failScreen(pct){
    const el=document.querySelector('#quiz'); if(!el) return;
    el.innerHTML=`<div class="card" style="max-width:640px">
      <div style="font-size:44px">🤔</div>
      <h1>${t('Almost — {p}%',{p:pct})}</h1>
      <p>${t('You need {p}% to earn your certificate. Think back over the mission, then try again.',{p:PASS})}</p>
      <button class="btn good" id="qRetry">${t('Try the quiz again')}</button>
      <div style="margin-top:10px"><button class="btn ghost small" id="qMenu">${t('Back to the menu')}</button></div>
    </div>`;
    el.querySelector('#qRetry').onclick=()=>start(S.missionId,S.opts);
    el.querySelector('#qMenu').onclick=()=>{ close(); if(window.MENU) MENU.open(); };
  }

  function close(){ const el=document.querySelector('#quiz'); if(el) el.classList.add('hidden'); }

  return {
    start, close,
    get active(){ const el=document.querySelector('#quiz'); return !!(el && !el.classList.contains('hidden')); }
  };
})();

/* ------------------------------------------------------------ CERT */
window.CERT = (function(){
  const TITLES = { nav:'Commands & Loops', m1:'Loops', m2:'Choices (if / else)',
                   m3:'Functions', puzzles:'Loops and counting',
                   race:'Loops inside loops' };
  const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function show(missionId, pct, opts){
    opts=opts||{};
    if(window.QUIZ) QUIZ.close();
    const el=document.querySelector('#cert'); if(!el) return;
    const name = (window.NET && NET.me) ? NET.me.display : t('Guest');
    const topic = t(TITLES[missionId]||missionId);
    const partial = !!opts.partial;
    const dateStr = new Date().toLocaleDateString();
    el.innerHTML=`<div class="card" style="max-width:640px">
      <div style="font-size:52px">${partial?'📜':'🏆'}</div>
      <h1>${partial ? t('Certificate of Completion') : t('Certificate of Mastery')}</h1>
      <div class="certbox">
        <div class="certname">${esc(name)}</div>
        <div class="certline">${t('has demonstrated understanding of')}</div>
        <div class="certtopic">${topic}</div>
        <div class="certmeta">${t('Quiz score')}: <b>${pct}%</b> &nbsp;·&nbsp; ${dateStr}</div>
      </div>
      <button class="btn good" id="certGo">${t('Back to the menu ▶')}</button>
    </div>`;
    el.classList.remove('hidden');
    el.querySelector('#certGo').onclick=()=>{ el.classList.add('hidden'); if(window.MENU) MENU.open(); };
  }
  return { show };
})();
