/* =====================================================================
   ROBOTS — the two fighters, as data.

   A robot is a row: which model file it is, how big it stands, how fast
   it moves, and the words the pit says about it. A third robot is a
   third row and a third .glb.

   THE MODEL IS THE MODEL. Both of these are rigged exports sitting in
   public/characters/models — thirty-three bones and fourteen animation
   clips each, already used by the arena on RYU. Nothing here draws a
   robot out of boxes: if the body needs changing it gets changed in the
   file, not in a thousand lines of THREE.BoxGeometry that drift away
   from it the moment anybody re-exports.

   WHAT IS NOT IN HERE ANY MORE. Reach, power, plate, swing speed, bulk
   and per-part hit points all came out with the fight. They were real
   numbers for a combat model that is being rebuilt from the feet up, and
   a row full of stats nothing reads is a row that is wrong and cannot be
   caught being wrong. `speed` is here because movement is the one thing
   the robot currently does.

   No DOM. Node loads this too, because the tests run there.
   ===================================================================== */
(function(root){

  const BASE='characters/models/';

  const LIST = [
    {
      id:'noisyboy', name:'NOISY BOY', em:'⚡',
      tag:'TALL AND LIGHT ON HIS FEET',
      blurb:'The taller of the two, and the quicker. Long in the leg, so '+
            'he covers the floor faster than he looks like he should.',
      model:BASE+'noisyboy.glb',
      /* Metres, head to floor. The .glb exports come out normalised to a
         height of one, so this IS the scale factor — see the ring, which
         measures the loaded body and divides. */
      height:4.6,
      speed:1.12,                 // multiplies BOUT.RULES.walk
      skin:{ trim:'#8fd3ff', plate:'#2f3f6b' }
    },
    {
      id:'ambush', name:'AMBUSH', em:'\u{1F6E1}',
      tag:'SHORT AND HEAVY',
      blurb:'Shorter, wider and slower across the floor. He is built to '+
            'be where he already is rather than to get somewhere else.',
      model:BASE+'ambush.glb',
      height:3.9,
      speed:0.88,
      skin:{ trim:'#ffb4a2', plate:'#5a3428' }
    }
  ];

  const byId = id => LIST.find(r=>r.id===id) || null;
  const IDS  = LIST.map(r=>r.id);
  /* A name that is not one of these is not an error worth a screen — it
     is the first robot on the list. Nobody's session stops for a typo in
     a saved setting. */
  const get = id => byId(id) || LIST[0];

  const API={ LIST, IDS, byId, get, BASE };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROBOTS=API;
})(typeof self!=='undefined' ? self : this);
