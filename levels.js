/* Desktop Quest 0.2a — the world is laid out like the real Linux screen.
   Icons top-left · App Launcher gate bottom · System menu tower top-right.
   Edit this file to add rooms; you do not need to touch game.js. */
window.LEVELS = {
  plaza:{
    w:60, d:46,
    ground:'#1b3a57', accent:'#2a4f74',
    /* col/row = the same grid the icons sit in on the real desktop */
    icons:[
      {id:'files',    emoji:'📁', name:'Files',       col:0, row:0, opens:'files'},
      {id:'textedit', emoji:'📝', name:'Text Editor', col:1, row:0},
      {id:'paint',    emoji:'🎨', name:'Paint',       col:2, row:0},
      {id:'music',    emoji:'🎵', name:'Music',       col:0, row:1},
      {id:'photos',   emoji:'🖼️', name:'Photos',      col:1, row:1},
      {id:'trash',    emoji:'🗑️', name:'Trash',       col:2, row:1}
    ],
    iconOrigin:{x:-24, z:-16}, iconGap:{x:7.5, z:8},
    gate:{x:-15, z:20},
    tower:{x:23, z:-18},
    portals:[{id:'m1', name:'MISSION 1', emoji:'🐛', x:10, z:-17, opens:'arena'}]
  },
  files:{
    w:32, d:26, ground:'#1d2c42', accent:'#2b4064', title:'Files',
    folders:[
      {id:'pictures',  emoji:'📁', name:'Pictures',  x:-8, z:-10, opens:'pictures'},
      {id:'documents', emoji:'📁', name:'Documents', x:0,  z:-10},
      {id:'music',     emoji:'📁', name:'Music',     x:8,  z:-10}
    ],
    exit:{x:12, z:2, back:'plaza'}
  },
  arena:{
    w:44, d:48, ground:'#2a1730', accent:'#43214f', title:'The Loop Chamber', arena:true
  },
  pictures:{
    w:24, d:20, ground:'#21324a', accent:'#31496b', title:'Pictures',
    folders:[{id:'screenshots', emoji:'📁', name:'Screenshots', x:0, z:-7}],
    exit:{x:9, z:2, back:'plaza'}   /* ✕ closes the whole app, like it really does */
  }
};
