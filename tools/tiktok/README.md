# TikTok clips, filmed out of the real game

Fifteen-second vertical videos of KORO (1080×1920, 30 fps), cut to a song,
filmed frame by frame from the actual game running under `npm run dev`. Not a
screen recording and not a diorama: the rig holds keys, puts the player where
a shot starts, and says where the camera stands. Everything else is the game.

Nothing here ships. The game is not modified: `rig.mjs` adds a few getters to
`planet.js` as it is served to the filming browser only.

```bash
cd tools/tiktok && npm install
node day.mjs --date 2026-09-30 --plan            # the day's eight posts
node day.mjs --date 2026-09-30 --out /tmp/day    # film them (starts the dev server if needed)
node publish.mjs --day /tmp/day                  # push to koro-clips, one URL per post
node make.mjs --type arcade --char zuri --sample --out /tmp/p   # one post, stills only
```

| File | |
|---|---|
| `rig.mjs` | the browser: takes over the game's clock, exposes the player, starts the dev server |
| `lib.js` | the shots: dive, swim, sprint, dance, seraph, fly, island, neon, arcade, card, each with a few camera set-ups |
| `fx.js` | camera override, flash and punch on cuts, beat pulse, caption, end card |
| `make.mjs` | one post: a recipe (montage, showcase, arcade, intro, pov, tour), a loud 15 s of a song, a character, the caption |
| `day.mjs` | eight posts, every type at least once, the five characters shared out, posting times |
| `publish.mjs` | the day's files to the public `koro-clips` repo (history replaced daily) so Metricool can fetch them |
| `songs/` | the music and its beat maps (made by koro-landing's `tools/analyze.mjs`) |
| `film.mjs`, `shots.js` | the first hand-made cut (the Sept 29 gameplay video) |

Things that are not obvious:

- **The Garden and the Stepping Stone are all trees.** No camera gets a clean
  look at anybody on them, so only the Falls and the Spire are used.
- **A new character loads in the background.** `AVATAR.pick()` builds a new
  body; wait for `AVATAR.body` to change, with the clock running, or the first
  shots show whoever was picked last (the dev server remembers).
- **Cabinets listen to the window**, not `G.keys`: the arcade is played with
  real key events.
- **Without a GPU** (the cloud) Chrome draws WebGL in software (SwiftShader).
  It works, and it is much slower than on a Mac.
