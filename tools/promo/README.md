# The trailer

`koro.mp4` in the repository root is thirty seconds of KORO, recorded out
of KORO. Not a screen capture and not a slideshow: the game, its interface
and the captions are composited into one 1280×720 canvas and that canvas
is recorded at thirty frames a second.

Nothing in here ships with the game. It is three files:

| | |
|---|---|
| `serve.js` | the rig — hands the page the director, takes the finished video back and writes it to disk |
| `director.js` | the compositor and the recorder |
| `cut.js` | the thirty seconds: seven scenes, what each says, and how each sets itself up |

## Making one

Two terminals:

```bash
npm run dev
```

```bash
node tools/promo/serve.js
```

`npm run dev` is the real server with its accounts and rooms held in
memory, so the multiplayer scene is two clients actually talking to each
other rather than a picture of it. Open <http://localhost:8799> in two
tabs, sign both in, put both in the same room, and in the tab you are
recording:

```js
for (const u of ['/director.js', '/cut.js']) {
  (0, eval)(await (await fetch('http://127.0.0.1:9099' + u)).text());
}
await CUT.warm(window.__ROOM);          // parse every model once
await PROMO.record(CUT(), { name: 'koro.mp4' });
```

Then make it a normal MP4 — MediaRecorder writes a *fragmented* one, which
has no duration and cannot be seeked:

```bash
avconvert -p PresetHighestQuality -s koro.mp4 -o koro-final.mp4 --replace
```

## Four things that are not obvious

**A tab nobody is looking at does not animate.** `requestAnimationFrame`
stops and `setTimeout` is clamped to about once a second, so the game runs
at three frames a second and every wait in the cut takes three times as
long as it says. For the length of a take, both are replaced by a Worker's
timer, which is not throttled. This is most of why the first eight takes
were wrong.

**Canvas capture is tied to being composited too.** Automatic
`captureStream(30)` publishes almost nothing behind another window;
`captureStream(0)` plus an explicit `requestFrame()` does not care who is
looking. And the game's own canvas is read with `drawImage` rather than as
a video track — legal only because the compositor now owns the frame
clock and runs inside the same tick as the render.

**The interface is DOM.** It goes through an SVG `foreignObject` with the
page's stylesheet inlined, snapshotted a few times a second and held
between. Load it from a `blob:` URL and the canvas is tainted and the
recorder gets nothing — it has to be a `data:` URL.

**Warm the rooms first.** Building a planet is three hundred milliseconds;
the first sight of one is two seconds of parsing models and compiling
shaders. Without `CUT.warm()` every mission arrives a beat after the
caption describing it.
