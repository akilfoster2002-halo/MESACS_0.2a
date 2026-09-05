/* =====================================================================
   WALLET — coins, XP and levels.

   Two currencies doing two different jobs, which is why there are two.

   XP only ever goes up and you cannot spend it. It is the record of what
   you have done, and it is what a level is: nothing in the game is gated
   on a level, so levelling up is a reward and never a wall. A child who
   wants to replay Level 0 nine times still earns, just less each time,
   because the point is to notice the work and not to farm it.

   COINS you spend, in the Wardrobe, on things you can see: a character
   to be, a ship to fly, a car to drive. Nothing bought changes how hard
   anything is — a paid ship is a paint job — so a student who never buys
   a thing is never behind one who does.

   Both ride in the same progress bag as finished missions, so they
   follow an account to any machine and survive a wiped browser.
   ===================================================================== */
window.WALLET = (function(){
  const COINS='w_coins', XP='w_xp', OWNED='w_owned';

  /* What each level costs, cumulatively. The steps grow, so level 2 comes
     fast enough to explain what levels are and level 10 means something. */
  function needFor(level){        // total XP to BE this level
    let n=0;
    for(let i=1;i<level;i++) n += 100 + (i-1)*60;
    return n;
  }
  function levelOf(xp){
    let l=1;
    while(l<60 && xp >= needFor(l+1)) l++;
    return l;
  }

  const P = () => window.PROGRESS;
  const coins = () => +(P() ? P().get(COINS,0) : 0) || 0;
  const xp    = () => +(P() ? P().get(XP,0) : 0) || 0;
  const level = () => levelOf(xp());
  /* how far through the current level you are, for the bar */
  function progress(){
    const x=xp(), l=level(), a=needFor(l), b=needFor(l+1);
    return { level:l, xp:x, into:x-a, span:Math.max(1,b-a), next:b };
  }

  function owned(){
    try{ return JSON.parse(P().get(OWNED,'[]')) || []; }catch(e){ return []; }
  }
  const has = id => owned().indexOf(id) >= 0;
  function give(id){
    if(!id || has(id)) return;
    const o=owned(); o.push(id);
    P().set(OWNED, JSON.stringify(o));
  }

  /* ------------------------------------------------------------- earning
     Everything that pays says WHY, so the toast can name it. Repeats pay a
     quarter, which is enough that practising is not punished and little
     enough that grinding is not a strategy. */
  const DONE_KEY = id => 'w_paid_'+id;
  function award(reason, xpAmt, coinAmt, once){
    if(!P()) return null;
    let x=xpAmt, c=coinAmt;
    if(once){
      if(P().get(DONE_KEY(once), false)){ x=Math.round(x*0.25); c=Math.round(c*0.25); }
      else P().quiet(DONE_KEY(once), true);
    }
    P().quiet(XP, xp()+x);
    P().quiet(COINS, coins()+c);
    P().flush();
    const out={ reason, xp:x, coins:c, levelled:false, level:level() };
    toast(out);
    return out;
  }
  /* the earn banner: what you got and what for, and a fanfare on a level */
  let lastLevel=null;
  function toast(o){
    const before=lastLevel;
    lastLevel=o.level;
    const el=box();
    const up = before!==null && o.level>before;
    o.levelled=up;
    el.className = up ? 'up' : '';
    el.innerHTML =
      (up ? `<div class="wl-up">${t('LEVEL {n}',{n:o.level})}</div>` : '') +
      `<div class="wl-row"><b>+${o.xp}</b> ${t('XP')}
         <span class="wl-c">+${o.coins}</span> ${t('coins')}</div>
       <div class="wl-why">${t(o.reason)}</div>`;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t=setTimeout(()=>el.classList.add('hidden'), up?4200:2600);
  }
  function box(){
    let el=document.querySelector('#wallet');
    if(!el){ el=document.createElement('div'); el.id='wallet'; el.className='hidden';
             document.body.appendChild(el); }
    return el;
  }
  function prime(){ lastLevel=level(); }     // so the first award is not a "level up"

  function spend(n){
    if(coins() < n) return false;
    P().set(COINS, coins()-n);
    return true;
  }

  return { coins, xp, level, progress, needFor, levelOf,
           owned, has, give, award, spend, prime };
})();
