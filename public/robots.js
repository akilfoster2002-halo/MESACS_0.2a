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

   WHAT IS NOT IN HERE ANY MORE. Reach, power, plate, bulk, per-part hit
   points — and then `speed` too. The first lot went with the fight. The
   speed went when movement became the student's job: how fast this
   robot crosses the floor is now whatever number they typed into
   `change x by`, and a row full of stats nothing reads is a row that is
   wrong and cannot be caught being wrong.

   `height` survives because something has to size the model, and the
   two being different heights is the only thing that still makes the
   pick a pick.

   No DOM. Node loads this too, because the tests run there.
   ===================================================================== */
(function(root){

  const BASE='characters/models/';

  const LIST = [
    {
      id:'noisyboy', name:'NOISY BOY', em:'⚡',
      tag:'TALL AND LIGHT ON HIS FEET',
      blurb:'The same `change x by` carries him further.',
      model:BASE+'noisyboy.glb',
      /* World units, head to floor. COSTUMES scales every .glb to stand
         one unit tall, so this IS the actor's `size` and nothing has to
         measure anything. */
      height:4.6,
      skin:{ trim:'#8fd3ff', plate:'#2f3f6b' }
    },
    {
      id:'ambush', name:'AMBUSH', em:'\u{1F6E1}',
      tag:'SHORT AND HEAVY',
      blurb:'Small numbers show up on him, because there is less of him.',
      model:BASE+'ambush.glb',
      height:3.9,
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
