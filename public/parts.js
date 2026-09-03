/* =====================================================================
   PARTS — the catalogue.

   Everything the sandbox can build is a row in this table, not a branch
   in the engine. A part declares what it looks like, what ports it has,
   what properties you can tune, and what the simulation should do with
   it. Adding a component is adding a row.

   PORTS are the whole grammar of the thing:
     pin / pout   power in / out   — the electrical circuit
     sin / sout   signal in / out  — the wire that carries a yes or a no
   A part with `pout` can feed a circuit; one with `pin` draws from it.
   Sensors have `sout` and no `pin` worth speaking of; logic gates take
   `sin` and give `sout`. Nothing here knows what a "robot" is — a robot
   is whatever a student wires together.

   `live:true` means the simulation actually drives it today. The rest
   place, connect, rotate and save like anything else, they just do not
   move yet — and the inspector says so rather than pretending.
   ===================================================================== */
window.PARTS = (function(){

  const CATS = [
    { id:'mech',   name:'Mechanical', em:'⚙️', a:'#ffd8a8' },
    { id:'elec',   name:'Electrical', em:'⚡', a:'#8fd3ff' },
    { id:'sense',  name:'Sensors',    em:'📡', a:'#a8e6cf' },
    { id:'logic',  name:'Logic',      em:'🧠', a:'#cdb4f6' },
    { id:'build',  name:'Structural', em:'🧱', a:'#ffb4a2' }
  ];

  /* shape: how to draw it. Kept to primitives so a part is cheap and the
     silhouette says what it is at a glance. */
  const P = (id,cat,name,em,color,shape,ports,props,live,help)=>
    ({ id, cat, name, em, color, shape, ports, props:props||{}, live:!!live, help:help||'' });

  const LIST = [
    /* ---------------------------------------------------------- mechanical */
    P('motor','mech','Motor','🌀',0xffb4a2,{k:'cyl',r:0.5,h:0.9},
      {pin:1,pout:1,sin:1,sout:1},{ speed:60, on:false }, true,
      'Spins while it has power and its switch is on. Speed is degrees a second.'),
    P('wheel','mech','Wheel','🛞',0x3b3059,{k:'cyl',r:0.7,h:0.35,lay:1},
      {pin:1,pout:1,sin:1,sout:1},{ speed:40, on:false }, true,
      'A powered wheel drives whatever it is connected to. Wire it to a motor or straight to power.'),
    P('piston','mech','Piston','🧯',0xbdb2d8,{k:'box',w:0.5,h:1.1,d:0.5},
      {pin:1,pout:1,sin:1,sout:1},{ reach:1.6, on:false }, true,
      'Pushes out while its signal is on, pulls back when it goes off.'),
    P('rotor','mech','Rotor','🚁',0xe8ecff,{k:'box',w:2.2,h:0.08,d:0.22},
      {pin:1,pout:1,sin:1,sout:1},{ speed:900, on:false }, true,
      'A propeller. Spins fast while powered — the lift is yours to arrange.'),
    P('hinge','mech','Hinge','🚪',0xffd8a8,{k:'box',w:0.9,h:1.6,d:0.16},
      {pin:1,pout:1,sin:1,sout:1},{ angle:95, on:false }, true,
      'Swings open when its signal is on. A door is a hinge and a reason.'),
    P('gear','mech','Gear','⚙️',0xbfa8e8,{k:'cyl',r:0.55,h:0.2},
      {pin:1,pout:1,sin:1,sout:1},{ ratio:1, on:false }, true,
      'Turns with the power it is given. Ratio changes how fast.'),
    P('spring','mech','Spring','🌾',0xa8e6cf,{k:'cyl',r:0.3,h:1.0},
      {},{ stiffness:5 }, false,
      'Structural spring. Placeable now; bounce comes with the physics pass.'),

    /* ---------------------------------------------------------- electrical */
    P('battery','elec','Battery','🔋',0xa8e6cf,{k:'box',w:0.7,h:1.0,d:0.7},
      {pout:1,sout:1},{ charge:100, capacity:100 }, true,
      'Stores power and feeds the circuit. Drains as things draw from it.'),
    P('generator','elec','Generator','🔌',0x8fd3ff,{k:'box',w:1.1,h:1.0,d:1.1},
      {pout:1,sin:1},{ rate:6, on:true }, true,
      'Tops batteries back up while it is running. Infinite patience, finite speed.'),
    P('wire','elec','Wire','➰',0xffe9a8,{k:'box',w:0.25,h:0.25,d:0.25},
      {pin:1,pout:1,sin:1,sout:1},{}, true,
      'Carries power and signal between two things. Connect, do not guess.'),
    P('switch','elec','Switch','🔀',0xcdb4f6,{k:'box',w:0.6,h:0.5,d:0.6},
      {pin:1,pout:1,sin:1,sout:1},{ on:false }, true,
      'Breaks the circuit when off. Flip it by hand, or let a program flip it.'),
    P('button','elec','Button','🔘',0xff9aa2,{k:'cyl',r:0.4,h:0.25},
      {pout:1,sout:1},{ on:false }, true,
      'On while it is held. The usual start of a WHEN.'),
    P('light','elec','Light','💡',0xffe9a8,{k:'sph',r:0.42},
      {pin:1,sin:1},{ on:false, bright:6 }, true,
      'Glows while powered and switched on. Draws a little.'),

    /* ------------------------------------------------------------- sensors */
    P('motion','sense','Motion Sensor','👁️',0xa8e6cf,{k:'box',w:0.6,h:0.6,d:0.6},
      {pin:1,sout:1},{ range:8, reads:0 }, true,
      'Reads 1 when a player is inside its range, 0 when not.'),
    P('distance','sense','Distance Sensor','📏',0x8fd3ff,{k:'box',w:0.6,h:0.4,d:0.6},
      {pin:1,sout:1},{ range:20, reads:0 }, true,
      'Reads how far away the nearest player is, in world units.'),
    P('lightsense','sense','Light Sensor','🔆',0xffe9a8,{k:'box',w:0.5,h:0.5,d:0.5},
      {pin:1,sout:1},{ reads:0 }, true,
      'Reads how much light is falling on it from nearby lamps.'),
    P('pressure','sense','Pressure Plate','⬜',0xbdb2d8,{k:'box',w:1.4,h:0.12,d:1.4},
      {pin:1,sout:1},{ reads:0 }, true,
      'Reads 1 while somebody is standing on it.'),
    P('temp','sense','Temperature','🌡️',0xffb4a2,{k:'cyl',r:0.22,h:0.9},
      {pin:1,sout:1},{ reads:20 }, true,
      'Reads the ambient temperature. Motors nearby warm it up.'),

    /* --------------------------------------------------------------- logic */
    P('and','logic','AND','🅰️',0xcdb4f6,{k:'box',w:0.7,h:0.5,d:0.7},
      {sin:1,sout:1},{ reads:0 }, true, 'Out is 1 only when every input is 1.'),
    P('or','logic','OR','🅾️',0xcdb4f6,{k:'box',w:0.7,h:0.5,d:0.7},
      {sin:1,sout:1},{ reads:0 }, true, 'Out is 1 when any input is 1.'),
    P('not','logic','NOT','🚫',0xff9aa2,{k:'box',w:0.6,h:0.5,d:0.6},
      {sin:1,sout:1},{ reads:0 }, true, 'Flips its input. 1 becomes 0.'),
    P('timer','logic','Timer','⏱️',0x8fd3ff,{k:'cyl',r:0.38,h:0.4},
      {sin:1,sout:1},{ every:2, reads:0 }, true,
      'Pulses on and off every few seconds, on its own.'),
    P('counter','logic','Counter','🔢',0xffd8a8,{k:'box',w:0.7,h:0.6,d:0.5},
      {sin:1,sout:1},{ count:0, target:5, reads:0 }, true,
      'Counts rising inputs. Reads 1 once it reaches its target.'),
    P('compare','logic','Comparator','⚖️',0xa8e6cf,{k:'box',w:0.7,h:0.5,d:0.7},
      {sin:1,sout:1},{ op:'>', value:50, reads:0 }, true,
      'Compares its input against a number and answers yes or no.'),

    /* ---------------------------------------------------------- structural */
    P('frame','build','Frame','🔲',0x8a80a8,{k:'box',w:1.2,h:1.2,d:0.2},{},{}, false,
      'Something to bolt the rest onto.'),
    P('platform','build','Platform','▭',0xbfa8e8,{k:'box',w:2.4,h:0.25,d:2.4},{},{}, false,
      'A floor panel. Stand on it, build on it.'),
    P('metal','build','Metal Block','⬛',0x9aa2b8,{k:'box',w:1,h:1,d:1},{},{}, false, 'Heavy and solid.'),
    P('wood','build','Wood Block','🟫',0xb9814f,{k:'box',w:1,h:1,d:1},{},{}, false, 'Light and cheap.'),
    P('glass','build','Glass','🔳',0xcfe8ff,{k:'box',w:1,h:1,d:1},{},{}, false, 'See-through panel.')
  ];

  const BY = {}; LIST.forEach(p=>BY[p.id]=p);
  const of = id => BY[id] || null;
  const inCat = c => LIST.filter(p=>p.cat===c);

  /* Which properties a program is allowed to read and to set. Keeping this
     next to the catalogue means the program editor never offers a student a
     property that does nothing. */
  function readable(def){
    const out=[];
    if(!def) return out;
    Object.keys(def.props).forEach(k=>out.push(k));
    return out;
  }
  function settable(def){
    if(!def) return [];
    // `reads` is what a part reports; a program sets everything else
    return Object.keys(def.props).filter(k=>k!=='reads');
  }

  return { CATS, LIST, of, inCat, readable, settable };
})();
