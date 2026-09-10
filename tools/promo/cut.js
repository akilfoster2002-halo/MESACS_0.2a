/* =====================================================================
   THE CUT. Thirty seconds, seven scenes, in the order somebody meets
   the game in: a world, then the thing the world is for, then what it
   teaches, then who else is in it.

   Every `enter` runs during the black of the join before it, so what it
   costs to load is never on screen. Nothing here reaches into a module's
   private state — each scene starts a mission the way a student does,
   types a program into the console the way a student does, and presses
   RUN. What is recorded is the game being played, not a diorama of it.
   ===================================================================== */
window.CUT = (function(){
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const $ = s => document.querySelector(s);

  /* Write a program into the console and run it — the same three actions
     in the same order a nine-year-old does them, so the trailer cannot
     show a thing the game cannot do. */
  /* TYPE IT, THEN SHOW IT AS BLOCKS, THEN GET OUT OF THE WAY.

     Typing is how a program gets into the console from here, but a wall of
     small monospace is not what this game looks like and not what sells it
     — the console converts what you have typed into the coloured blocks
     when you switch modes, and that is the picture. Then RUN, then close,
     because the point of the blocks is the thing they move and you cannot
     see it through a panel. */
  async function program(text, showMs, watchFirst){
    CODE.show();
    if(CODE.setMode) CODE.setMode('text');
    await sleep(200);
    const ta=$('#conTA');
    if(ta){ ta.value=text; ta.dispatchEvent(new Event('input',{bubbles:true})); }
    await sleep(260);
    if(CODE.setMode) CODE.setMode('blocks');
    /* And check it took. The console only converts what it has actually
       READ — the textarea's own input handler is what tells it — and if the
       event has not landed yet the switch converts nothing and drops back
       to typing, which is the one mode this is trying not to film. */
    if(!(CODE.script && CODE.script.length)){
      if(CODE.setMode) CODE.setMode('text');
      await sleep(120);
      const t2=$('#conTA');
      if(t2){ t2.value=text; t2.dispatchEvent(new Event('input',{bubbles:true})); }
      await sleep(220);
      if(CODE.setMode) CODE.setMode('blocks');
    }
    await sleep(showMs===undefined?1200:showMs);
    const run=$('#conRun'); if(run) run.click();
    await sleep(watchFirst===undefined?380:watchFirst);
    CODE.close();
  }
  /* Not #keys and not #codeBtn: the key hint sits in the bottom-left where
     the caption goes, and a floating "Code Console" button in the middle of
     the screen is a button over the gameplay it is offering to interrupt. */
  const hud = ()=>['#objectives','#briefing','#console','#deck'];
  /* Every mission opens with a full-screen card explaining the idea. It is
     the best thing in the game and the worst thing in a trailer — it covers
     the gameplay it is introducing. Read, then dismissed. */
  async function teach(ms){
    await sleep(ms||700);
    const b=$('#teachGo'); if(b) b.click();
    const c=$('#teach'); if(c) c.classList.add('hidden');
  }

  /* One long shot each, and the camera keeps moving in all of them: a
     still frame of a 3D game reads as a screenshot of a 3D game. */
  function look(dyaw, dpitch, secs){
    const t0=performance.now(), y0=G.yaw, p0=G.pitch;
    (function step(){
      const k=Math.min(1,(performance.now()-t0)/(secs*1000));
      G.yaw=y0+dyaw*k; G.pitch=p0+dpitch*k;
      if(k<1) requestAnimationFrame(step);
    })();
  }
  const hold=(code,ms)=>{ G.keys[code]=true; setTimeout(()=>{G.keys[code]=false;}, ms); };

  /* WALK THE WHOLE TRAILER ONCE BEFORE RECORDING IT.

     None of the room builds are slow — a planet is three hundred
     milliseconds, a mission is five. What is slow is the first sight of
     anything: a GLB parsed, a texture uploaded, a shader compiled. So the
     first take put every mission on screen a second or two after the
     caption describing it, and by the end the pictures were a scene behind
     the words.

     Nothing here is a trick: it is the same rooms, entered the same way,
     and afterwards every model is in memory and every shader is built. The
     recording then gets the game as it is on the second visit — which is
     the game as anybody who has played for a minute has it. */
  async function warm(room){
    const hud=$('#hud');
    if(hud) hud.classList.remove('hidden');
    for(const go of [()=>SCHOOL.start(3), ()=>FLIGHT.start(0), ()=>SUB.start(0)]){
      go();
      await sleep(1400);
      const b=$('#teachGo'); if(b) b.click();
      const c=$('#teach'); if(c) c.classList.add('hidden');
      await sleep(700);
    }
    if(window.SUB) SUB.stop();
    if(window.FLIGHT) FLIGHT.stop();
    if(window.SCHOOL) SCHOOL.stop();
    CODE.close();
    PLANET.enter(null, 'arena');
    await sleep(2600);
    PLANET.leave();
    PLANET.enter(room||null, 'hub');
    await sleep(2600);
    return 'warm';
  }

  const scenes = function(){ return [

  /* ---------------------------------------------------------- 0 → 4.5 */
  { id:'land', secs:4.0, dom:['#objectives'],
    say:'KORO', sub:'think. code. create.',
    async enter(){
      PLANET.enter(window.__ROOM||null, 'hub');
      await sleep(1100);
      G.firstPerson=false; G.pitch=-0.05;
      look(0.5, 0.06, 4.2);
      hold('KeyW', 3600);
    } },

  /* ---------------------------------------------------------- 4.5 → 10 */
  { id:'school', secs:5.0, dom:hud(),
    say:'Write a program.', sub:'Watch it fly.',
    async enter(){
      PLANET.leave();
      $('#hud').classList.remove('hidden');
      SCHOOL.start(3);                       // glide: one command, both axes
      await teach(250);
      if(window.COACH) COACH.stop();
      await program('glide to 4,4', 1000, 200);
    } },

  /* ---------------------------------------------------------- 10 → 15 */
  { id:'flight', secs:4.5, dom:hud(),
    say:'Six missions.', sub:'Coordinates, loops, choices, functions.',
    async enter(){
      SCHOOL.stop();
      /* Straight to the leg, not through the door. startMissionRoom('flight')
         plays INTRO's ten seconds of film before it calls FLIGHT.start —
         which is right when a student walks in and wrong in a four-second
         shot: the caption said Space Explorer while the HUD still listed
         Flight School's levels, because the mission had not begun yet. */
      if(window.INTRO && INTRO.active) INTRO.skip();
      FLIGHT.start(0);
      await teach(500);
      await program('change y by 1\ncoast()\nchange x by -1\nchange y by -1', 950, 220);
    } },

  /* ---------------------------------------------------------- 15 → 20 */
  { id:'sub', secs:4.5, dom:hud(),
    say:'Sensing and conditionals,', sub:'two hundred metres down.',
    async enter(){
      if(window.FLIGHT) FLIGHT.stop();
      SUB.start(0);
      await teach(500);
      const K=SUB.STAGES ? SUB.STAGES[0] : null;
      await program((K && K.learn && K.learn.code)
        || 'repeat until at the beacon\n  if wall ahead\n    turn 90\n  end\nend', 950, 220);
    } },

  /* ---------------------------------------------------------- 20 → 25 */
  { id:'together', secs:5.0, dom:['#objectives','#chat'],
    say:'Your whole class,', sub:'on the same planet.',
    async enter(){
      if(window.SUB) SUB.stop();
      CODE.close();
      PLANET.enter(window.__ROOM||null, 'hub');
      await sleep(1100);
      /* Stand where the other person is, and look at them. A shot of an
         empty field with somebody's name in the chat is not a shot of a
         multiplayer game. */
      const mc=PLANET.BUILDINGS[0];
      if(mc && mc.frame){
        const me=PLANET.where;
        me.dir.copy(PLANET.dirOf(5.5, -4.2));
        me.fwd.copy(PLANET.facing(me.dir, PLANET.dirOf(5.5, -1.5)));
      }
      G.firstPerson=false; G.pitch=-0.02;
      look(0.34, 0.03, 4.4);
      hold('KeyW', 2200);
    } },

  /* ---------------------------------------------------------- 25 → 29 */
  { id:'club', secs:5.0, dom:['#objectives','#deck'],
    say:'And a room where the set', sub:'is a loop you can play.',
    async enter(){
      PLANET.leave();
      PLANET.enter(null, 'arena');
      await sleep(650);
      const club=PLANET.BUILDINGS.find(b=>b.id==='club');
      if(club && club.frame){
        // on the floor, facing the booth, rather than outside looking at a wall
        PLANET.where.dir.copy(
          club.dir.clone().applyAxisAngle(club.frame.right, 9/PLANET.PR).normalize());
        PLANET.where.fwd.copy(PLANET.facing(PLANET.where.dir, club.dir));
      }
      G.pitch=0.04;
      await sleep(260);
      PLANET.use('decks');
      await sleep(900);
      const drop=$('#dkDrop'); if(drop) drop.click();     // and land the drop on camera
      look(0.20, 0.0, 3.0);
    } },

  /* ---------------------------------------------------------- 29 → 31 */
  { id:'end', secs:2.0, card:'KORO', cardSub:'think. code. create.' }

  ]; };
  scenes.warm=warm;
  return scenes;
})();
