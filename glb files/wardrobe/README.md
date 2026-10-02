# The wardrobe: how clothes are made, and how we know they are clean

The runtime is `public/wardrobe.js` (what everybody wears) and `public/closet.js`
(the panel, TAB from the quick change). This folder holds the tools that make the
files those two load, and the check that every file must pass before it ships.

Everything runs in headless Chrome over the repository's own three.js:

```
node "glb files/wardrobe/lab.mjs" <command> ...
```

`lab.mjs` serves the repo and opens `lab.html` (or `try.html`, the fitting room).
It calls one function there and writes the result to disk. It borrows puppeteer
from `tools/tiktok/node_modules`.

Scratch goes in `work/`, which git ignores. Reference photos of a real person
stay there and nowhere else.

## The rule that keeps swaps clean

**A garment is cut from the same person, wearing it.** Never build a garment as
a separate object and wrap it around a body. That is how the first jacket ended
up with a hand moulded into each sleeve, ragged hems and a shredded wrist.

1. **The picture.** Take the body's own reference picture (Robin: Higgsfield
   image `22803068…`, `work/robin2-ref.png`). Edit it with `gpt_image_2_5` at
   high quality so it adds *only* the garment, with the same pose and framing.
   Ask for bare hands below cuffs and feet left where they are.
2. **The dressed person.** Lift that picture with the settings the body was made
   with: `meshy_v7_image_to_3d`, ultra, texture, PBR, a-pose,
   `target_polycount` 150000. That costs 44 credits. Meshy makes one surface,
   so the sleeves have nothing inside them: the hands are hers.
3. **The cut.** Run:

   ```
   lab.mjs extract work/dressed-X.glb public/characters/models/character-robin.glb work/x-X.glb \
     '{"on":[regions],"ref":"work/robin2-ref.png","pic":"work/r3-X.png", ...}'
   ```

   The steps it runs:
   - **Line up.** It lines the dressed person up on the body, then bends the
     body's arms and legs joint by joint to match.
   - **Classify.** A point is garment when it lies over a region the garment
     may cover (`on`) and has the garment's own colours. Those colours are
     learned from where the two pictures differ, with her skin removed. It must
     also differ from her there, by colour or by standing off her.
   - **Use the picture where it's exact.** On the torso, points that face the
     camera use the picture itself.
   - **Clean the shape.** A majority vote and an open-and-close tidy it. Specks
     are dropped and pinholes filled, but a hole that is her skin is never
     filled. Hanging triangles are removed and the cut edge is smoothed into
     a line.
   - **Back to rest.** The garment is unposed into the body's rest pose and
     pushed a few millimetres off the skin. It gets the body's weights, with
     every copy of a seam point weighted alike.
   - **Covers.** It records `covers`: exactly which of the body's vertices it
     lies over. `wardrobe.js` stops drawing those, and only those. The skin
     ends just inside a cuff, and nothing is ever cut by bone region.
   - **Glow mask.** It bakes a glow mask of the garment's teal lines, which TSH
     lights.
   - **The review image.** It writes `-cut.jpg` beside the output. This is the
     dressed person with the garment in magenta, front and back, and it is the
     first thing to look at.

   Settings that worked:

   | garment | `on` | other options |
   |---|---|---|
   | jacket | `torso, neck, upperArms, forearms, hands, hips` | `"near":60` |
   | gauntlets | `forearms, hands, upperArms` | `"keep":0.4,"fill":0.04` |
   | jeans | `hips, thighs, shins, feet, torso` | `"reach":0.06,"colour":45,"picture":false` |
   | shoes | `feet, shins` | `"always":["feet"],"near":75,"fill":0.08` |

   - **Jeans:** the colour threshold is lower because dark denim over black
     shorts differs only a little. The picture test is off because those two
     colours barely differ in the pictures either.
   - **Shoes:** `always` takes anything in the shoe's colours on the feet,
     since white shoes over white socks differ in neither colour nor depth.

4. **Ship it.** Run `sh shrink.sh work/x-X.glb public/characters/wardrobe/<item>/robin.glb`.
   This welds the mesh, keeps about half its triangles with the edges kept
   where they are, makes the maps WebP, and quantizes. The game binds each
   garment with its own inverse binds, so quantized files are fine.
5. **Other bodies.** Run
   `lab.mjs transfer work/x-X.glb character-robin.glb character-<b>.glb out.glb ['{"gap":0.007}']`.
   It moves the garment bone by bone onto the other body, keeps each point's
   distance off the skin, and measures that body's own `covers`. Then shrink
   and check it like any garment. A body with bulky clothes built into its
   model may need a bigger `gap`. If the check still fails, it doesn't get the
   garment: Theo's built-in coat, for one.

## Layers

`wardrobe.js` wears things in this order: shoes, then trousers, then jackets,
then gloves. Where two garments overlap, the one underneath stops being drawn
over the skin the outer one covers. So a sleeve ends where the gauntlet starts,
tucked in, and a shoe's collar goes up inside a jeans hem. The match is made
once per pair, when the outfit changes.

The things made in code (the flash bangle) are measured on whatever is on the
wrist, so the bangle hugs the gauntlet's cuff, or her skin without one. They
are made again whenever the garments under them change.

## The check

```
node "glb files/wardrobe/lab.mjs" check robin "outer:tech-jacket,hands:gecko-cuffs" work/qa.jpg
```

The game's own `avatar.js` and `wardrobe.js` dress the body. The check then
runs it through fourteen clips at eight frames each: idle, walk, sprint, jump,
kneel, roll, flip, dance, salsa, climbs, riding, strafes and walking backwards.
It measures five things against the body at rest:

- **holes:** skin that isn't drawn but has nothing over it now (see-through).
- **poke-through:** skin that was under a garment at rest and is outside it now.
- **doubled:** skin that is drawn with a garment surface lying right on it.
- **skin:** how much of a garment is skin-coloured, such as a hand moulded into
  a sleeve. The old jacket fails on this one.
- **buried:** how much of a garment lies under her drawn surface at rest. This
  catches jeans sitting inside a body's own wider trousers; Nia's star-print
  pair showed through until it was measured.

The result goes into `qa.json` with the files' fingerprints. The jpg shows the
worst frame on magenta, so any hole shows.

`tests/wardrobe.test.js` fails whenever:
- a garment file has no passing check,
- a garment or body file changed after its check,
- a garment has no `covers` for its body,
- Robin's whole TSH look hasn't passed together.

A file can't reach players without being checked.

## Accessories and things made in code

Accessories are rigid models on one bone: the pack, cap, beanie and shades.
They fit anybody and are sized from the skeleton when they go on. `tune`
nudges them:
- `size`: fraction of head (or back) length.
- `along`: how far up the bone.
- `fwd`: forward of that.
- `brim:true`: turns a cap's brim to the front.

Anything that has to bend with a joint, like shoes on a foot or gloves on a
wrist, is made as a garment instead.

## Adding an item

Add one entry to `ITEMS` in `public/wardrobe.js`. A garment lists `bodies`, the
bodies it has files for and has passed the check on. Then run `npm test`.
