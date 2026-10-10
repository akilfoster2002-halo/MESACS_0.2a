# TSH → Godot export

The Godot test stage (`res://scenes/tsh_stage.tscn`) uses the browser game's own TSH city and characters, exported
from the running game so they match it exactly. To refresh them after the browser version changes:

1. `npm run dev` (the browser game, signed in) and `node koro-godot/tools/tsh_export/recv.js`
2. In the browser: open TSH and get to the night street (any beat outside — Robin dressed in her kit)
3. Paste `export.js` into the console (or load it: `s=document.createElement('script');s.src='http://localhost:8899/export.js';document.head.appendChild(s)`)
4. `sh koro-godot/tools/tsh_export/finish.sh`, then open the project (Godot re-imports)

`gltfexporter.js` is three's GLTFExporter bundled against the game's three.js (r185), which calls `Source`
what the exporter calls `TextureSource` — export.js aliases it.
