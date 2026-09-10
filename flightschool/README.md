# Flight School — standalone

A four-quadrant coordinate grid you program a spaceship across. Ten
lessons, from one command to a course you fly diagonally — and between
them every block in Scratch's Motion drawer: `move`, both turn arrows,
`point in direction`, `point towards`, `go to`, `go to random position`,
`glide _ secs to`, and the four coordinate blocks. English and Spanish.

This folder is the whole site. **No server, no account, no network** — open
`index.html` off a static host and it runs.

## Run it

Any static server will do:

```bash
npx --yes http-server flightschool -p 8790 -c-1
```

Then open <http://localhost:8790>. It also works from a USB stick or a
shared drive, as long as it is served over http — `file://` will not do,
because the browser refuses to fetch the ship model from it.

## Deploy it

Copy the folder. That is the whole deploy: GitHub Pages, Netlify drop,
a school web share, anything that serves files.

## What is in here

| | |
|---|---|
| `index.html` | the page: the level menu, the HUD, the finish card |
| `app.js` | the host — a `G` with a scene in it, the frame loop, the C key, the RUN wiring |
| `ship.js` | the four lines of `public/shop.js` this needs, without the shop |
| `vendor/` | **generated.** Do not edit. |

`vendor/` is copied out of `public/` by `tools/build-flightschool.js`, so
there is no second copy of the game to keep in step — the console, the
compiler, the walkthrough and the mission itself are the same files KORO
runs, and the stylesheet is lifted whole out of `public/index.html`.

After changing anything in `public/`:

```bash
npm run build:flightschool
```

That re-copies `vendor/` and re-stamps every `?v=` in `index.html` with a
hash of what went in, so nobody gets half the old files after a deploy.

## Teaching it

The level menu on the front page jumps straight to any of the six, so a
lesson can start wherever the class is. Level 1 walks a student through
opening the console, picking a block, setting its number and pressing RUN,
with the thing to click lit up — nothing else is clickable while it does.

Keys: **C** opens the console, **R** re-flies the level from the start,
**Esc** closes the console.
