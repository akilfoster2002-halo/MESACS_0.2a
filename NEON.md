# NEON — the arcade in the clouds

**It runs.** Fly up to the island over Wano, walk through the arch, play.

This is a handoff note. If you are picking this up cold (a Claude Cloud
session, or Akil on another machine), read this first and you will not have to
re-derive anything.

---

## What it is meant to be

An arcade you fly to. A flying island over Wano with clouds round it, a neon
pavilion on top, and inside it five machines you **play** — not write.

That last word is the whole point. Everything else in KORO that looks like a
game is a game you *write*: the ring, Pong, the swarm and the circuit are all
programs, and the pleasure in them is the program. An arcade is the other
thing — you put your hands on a machine, it is hard, and at the next cabinet
there is somebody to play against. A child who has spent an hour writing
`repeat` has somewhere to go.

Three of the five are solo; two are head-to-head over the socket against
another player in the same room.

---

## State of play

### Done and committed on this branch

| | |
|---|---|
| `public/islands.js` | A fifth sky island over Wano — `{ id:'neon', lon:-8, lat:22, r:31, alt:96 }`. The flattest and biggest of the five, because it is the only one you go *into* rather than land on, and the top is a landing apron. On it: a hexagonal pavilion, neon rim top and bottom, a lit arch, a marquee readable from the ground, two approach pylons. Its walls are boxes in the **island's own frame**, tested in `blocked()` beside the rock — the planet's building collision works in a building's frame and knows nothing about the sky. Plus a drifting bank of cloud billboards round and under it (`clouds()`, moved in `tick()`). |
| `public/cabgames.js` | The five games. One 320×240 buffer, pixels left square, a 3×5 arcade font written out as pixels. `BLOCK DROP`, `SNAKE`, `STAR SWARM` (solo); `VOLLEY`, `TANK` (two-player, and each plays a machine on its own too). |
| `server/index.js` | The match-maker (`t:'arc'`), and `arcade` added to `WENT`. |
| `public/planet.js` | `use('neon')` → `wentTo('arcade')` → `leave()` → `NEON.enter(server)`. |
| `public/net.js`, `koro-godot/scripts/net.gd` | Both clients say "went up to NEON". |

### Finished

| | |
|---|---|
| `public/neon.js` | The hall: two storeys (a real mezzanine you can walk under and climb onto, LED stairs up the left wall), a starry black ceiling hung with glowing hexagons, blue trusses, neon trim, the window wall with clouds drifting past, five cabinets running their attract loops, and the HIGH SCORES board over the mezzanine. E at a cabinet takes the whole window; Esc walks away. VOLLEY and TANK ask **1** (the machine) or **2** (somebody here). E at the arch takes you back out onto the island's apron, facing away from the door. |
| `public/index.html` | Loads `cabgames.js` and `neon.js` after `planet.js`; `?v=` bumped. |
| `public/net.js` | `NET.arc(msg)` and `NET.onArc`. |
| `public/planet.js` | `'neon'` added to the ids `use()` accepts — it refused it silently, so the door did nothing. `enter()` takes `{island:'neon'}` to put you down on the island rather than the grass under it. |
| `public/islands.js` | `doorOut()` — where the arch is, read off the mesh itself. |
| `server/` | `arcade_scores` table (and the same statements in `memdb.js`); `GET /api/neon/scores`, `POST /api/neon/score` — solo cabinets only, capped, only ever raised. Your own best also goes in the progress bag. |
| `tests/neon.test.js` | Two real sockets queue at VOLLEY, are paired with one seed, relay state and keys, and the host is told when the guest leaves; the score board. |

## How the multiplayer works

The server does **not** know the rules of VOLLEY or TANK and never should.
The games live in the browser where a class can read and change them; the only
thing that has to be on the server is *who is playing whom*.

```
{t:'arc', op:'queue',  game:'volley'}   →  'waiting', and the room is told 'open'
                                        →  or, if somebody was already waiting:
   both sides get {op:'match', game, you:'A'|'B', seed, foe}
{t:'arc', op:'in', d:…}                 →  relayed to the other side
{t:'arc', op:'st', d:…}                 →  relayed to the other side
{t:'arc', op:'over', winner}            →  relayed
{t:'arc', op:'cancel'}                  →  out of the queue
                                           the other side gets {op:'gone'}
```

**One side is the host and its word is final.** `A` is the host: it simulates
and sends state (`op:'st'`); `B` sends what it is pressing (`op:'in'`) and
eases onto what it is told. That is a decision with a cost — the guest is a
frame behind the truth — and the alternative, both sides simulating and hoping
they agree, is a desync nobody in a classroom can debug.

**The seed matters.** Both browsers run the same game; a ball that serves left
on one screen and right on the other is two different games. `seeded(seed)` in
`cabgames.js` is the shared generator.

**The queue is per room, per game** — you play the people you are in a room
with, which is the rule the rest of the game already runs on. A player is
dropped from the queue on cancel, on leaving the room, and on the socket
closing; the other side is always told, because a game that simply stops looks
broken.

Each two-player game exposes `net(m)` (what arrived) and `out()` (what to send
this network tick, ~20/sec). Wire those to the socket and they work.

---

## What could come next

- Real art (below).
- The Godot client has no NEON room yet; it only says "went up to NEON".

## How it was built, in order

1. **`public/neon.js`** — the interior, as a flat room in the `game.js` engine.
   `public/chatroom.js` is the closest model: it builds a room, walks you in
   it, puts other players in it, and hands `E` to whatever you are looking at.
   From the reference art Akil supplied: a dark two-storey hall, a black
   ceiling with stars and a field of floating hexagon panels with glowing
   edges, blue-lit trusses, LED-strip stair treads up to a mezzanine, neon
   tube trim, five cabinets on the floor, and a tall window looking out at the
   clouds (the island is in the sky — use it).
2. **Wire the scripts and the door**, and check you can fly up, walk in, and
   see the room.
3. **The client matchmaking**, then verify a real two-player game.
4. **High scores.**

### Verifying the multiplayer

Do not trust it until two sockets have actually played. The pattern that
worked for chat rooms: start `PORT=3111 node tools/dev-server.js`, drive one
player in the browser pane, and run a second as a plain `ws` client from node
(`node_modules/ws`) that joins the same room and queues at the same cabinet.
Check the pairing, the relay, and the `gone` on disconnect.

### If you want scores to last

There is no table for them. Add `arcade_scores` to `server/db.js` (the schema
is `CREATE TABLE IF NOT EXISTS` on boot, so it is additive and safe), teach
`server/memdb.js` the same statements — it stands in for Postgres under
`npm run dev` and in the Mac app, and it answers statements literally, so
every new one has to be added by hand — and add `GET/POST /api/arcade/score`.
Personal bests could instead go in the progress bag, which already syncs to
the account and needs no migration.

---

## The graphics are placeholder, on purpose

Akil generates the real art in **Higgsfield → Meshy** (see
`glb files/README.md` for the character pipeline; the islands use the same
route). Nothing in this branch is meant to be final: it is code geometry so
that the room, the games and the multiplayer can be built and tested now.

When the art arrives, follow the pattern `islands.js` already uses — a `model:`
key on the record, `loadModel()` if it is set, built geometry if it is not — so
a `.glb` replaces a placeholder with no other change. Suggested slots:
`public/arcade/hall.glb`, `cabinet.glb`, `stool.glb`, and a `model:` on the
`neon` isle for the pavilion.

---

## Names, so nothing gets confused

There are **two arcades** and they are different places:

- **THE ARCADE**, on VOLTA (`public/arcade.js`) — the shelf where games *your
  class made* are published, played and rated. It already exists.
- **NEON**, this one, on a sky island over Wano — where you play the classics
  and each other.

If that turns out to be one too many for a nine-year-old, renaming NEON is a
small change and renaming the VOLTA one is not.
