/* =====================================================================
   ROBOTS — the two fighters, as data.

   A robot is not a class and not a model file. It is a row: how it is
   built, how it fights, and what it looks like. Everything the fight
   needs is a number here, and everything the screen needs is a colour
   or a length here, so a third robot is a third row and nothing else.

   THE TWO ARE OPPOSITES ON PURPOSE. A pick screen where both choices
   are fine is not a choice, and a student who cannot say what they
   picked cannot say why they lost. So:

     NOISY BOY   long arms, quick hands, thin plate.
                 He hits you from where you thought you were safe, and
                 he cannot take it back.
     AMBUSH      short arms, heavy hands, thick plate.
                 He has to get in, and once he is in you are in trouble.

   Both of them are drawn here from scratch — proportions, plate colours
   and trim. The names come from the film; the bodies do not.

   WHAT THE NUMBERS MEAN. Everything is a multiplier on the rules in
   bout.js, not a replacement for them, so the rules stay the one place
   a fight is balanced from and a robot stays a lean and readable row.
   A multiplier of 1 is "the standard robot", which is a thing neither
   of these is — it is only the middle they are measured either side of.

   No DOM. Node loads this too, because the referee runs there.
   ===================================================================== */
(function(root){

  const LIST = [
    {
      id:'noisyboy', name:'NOISY BOY', em:'⚡',
      tag:'LONG ARMS, THIN PLATE',
      blurb:'He reaches further than anybody expects and hits before you are ready. '+
            'Stay out at the end of his arms. What lands on him, hurts him.',
      /* ------------------------------------------------------ fighting */
      reach:1.18,     // how far his punches get, against the standard
      power:0.92,     // what they do when they arrive
      armour:0.82,    // how much of a hit the plate eats — under 1 means it eats LESS
      speed:1.12,     // walking and running
      swing:0.85,     // how long a punch takes, so under 1 is quicker hands
      bulk:0.85,      // how well he stands up to a shove — under 1 is thrown further
      energy:1.10, cool:1.15,
      parts:{ left_arm:90, right_arm:90, legs:100, sensor:110, core:180 },
      /* --------------------------------------------------------- body
         Lengths in metres, because the sim thinks in metres and a rig
         that thinks in anything else has a conversion in it to get
         wrong. Tall and narrow: the silhouette says "reach" across a
         dark arena before any number does. */
      rig:{ height:4.6, shoulder:1.30, arm:2.05, leg:1.95, chest:0.78, head:0.42 },
      skin:{ plate:'#2f3f6b', trim:'#8fd3ff', glow:'#8fd3ff', joint:'#1a2238' }
    },
    {
      id:'ambush', name:'AMBUSH', em:'\u{1F6E1}',
      tag:'SHORT ARMS, HEAVY PLATE',
      blurb:'He has to walk through what you throw to reach you, and he can. '+
            'Get him close and his short arms stop being a problem.',
      reach:0.86,
      power:1.20,
      armour:1.25,    // over 1: the same punch is worth less against him
      speed:0.88,
      swing:1.18,     // slow hands: the price of the plate and the power
      bulk:1.30,
      energy:0.95, cool:0.90,
      parts:{ left_arm:120, right_arm:120, legs:120, sensor:90, core:230 },
      rig:{ height:3.9, shoulder:1.55, arm:1.45, leg:1.45, chest:1.05, head:0.38 },
      skin:{ plate:'#5a3428', trim:'#ffb4a2', glow:'#ff9a5c', joint:'#241511' }
    }
  ];

  const byId = id => LIST.find(r=>r.id===id) || null;
  const IDS  = LIST.map(r=>r.id);
  /* Anything that arrives over a socket names a robot, and a name that
     is not one of these is not an error worth a screen — it is the
     first robot on the list. Nobody's fight stops for a typo. */
  const get = id => byId(id) || LIST[0];

  const API={ LIST, IDS, byId, get };
  if(typeof module!=='undefined' && module.exports) module.exports=API;
  else root.ROBOTS=API;
})(typeof self!=='undefined' ? self : this);
