# The wardrobe: how clothes are made

The runtime is `public/wardrobe.js` (what everybody wears) and `public/closet.js`
(the panel: TAB from the quick change). This folder holds the tools that make the
files they load: a body in a plain base outfit, garments fitted to that body, the
same garments fitted to other bodies, and a fitting room to check the result in
the game's own code before anything ships.

Everything runs in headless Chrome over the repository's own three.js:

```
node "glb files/wardrobe/lab.mjs" <command> ...
```

`lab.mjs` serves the repo, opens `lab.html` (or `try.html`), calls one function
on `window.LAB` / `window.TRY`, and writes the result to disk. It borrows
puppeteer from `tools/tiktok/node_modules`. Scratch goes in `work/`, which git
ignores. Keep reference photos there and nowhere else.

## The three kinds of thing

| kind | what it is | one file fits |
|---|---|---|
| **garment** | a skinned mesh in one body's bind space (jacket, trousers). It hides the body regions it covers. | one body: `characters/wardrobe/<item>/<body>.glb` |
| **accessory** | a rigid model hung on a bone (shoes, pack, cap, glasses), sized from the skeleton when it goes on | everybody: `characters/wardrobe/<model>.glb` |
| **made** | drawn in code in `wardrobe.js` (hood, cuffs, bangle) | everybody |

## A base body (a character in their modest base outfit)

Robin is the first. Her script is `../cast/build-robin.sh`.

1. **The picture.** Use `gpt_image_2_5` (Higgsfield) with the reference photos
   as `image_references`. Ask for a full-body T-pose in the base outfit: fitted
   grey tee, black knee-length bike shorts, white socks, on plain white.
2. **The body.** Run `meshy_v7_image_to_3d` (ultra, texture, PBR) on that
   picture. It costs about 44 credits. The cheap SAM 3D body (1 credit) comes
   back at about 4k triangles and looks it.
3. **The rig.** Run `meshy_rigging` (5 credits). Its 24-bone skeleton maps to
   ours with `../higgsfield.map.json`.
4. **The clips.** Run `sh "glb files/cast/build-robin.sh"`. It retargets every
   clip the game uses and fixes the material: glTF's default metalness of 1
   renders a SAM or Meshy body black. It then halves the triangles, quantizes,
   and writes `public/characters/models/character-<id>.glb`.
5. **The card.** Run `lab.mjs card <character.glb> <out.png>` to make the
   256×328 roster card.

`lab.mjs base <sam.glb> <character.glb> <out.glb>` puts SAM's body on an
existing character's skeleton (ICP plus weight transfer). It was the first
attempt; Meshy rigging is better.

## A garment

1. Draw it on the body's reference picture. Edit the picture with
   `gpt_image_2_5` ("the same person, now wearing …"), so the two images differ
   only by the garment.
2. Run `sam_3_3d` on the edited picture to get `<garment>-sam.glb`.
3. Run `lab.mjs garment <sam.glb> <body.glb> <ref.png> <garment.png> <out.glb>`.
   - It differences the two pictures to find where the garment is, then puts
     SAM's mesh in that box, centred in depth on the body's skin.
   - It pushes the mesh outward off the skin only, never through hair. Hair is
     the dark texels. The push is smoothed.
   - It drops the loose fragments and weights every vertex from the nearest
     skin vertex that faces the same way.
4. Run `lab.mjs transfer <garment.glb> <from-body.glb> <to-body.glb> <out.glb>`
   to fit it to everybody else. It moves the garment bone by bone from one
   body's bind pose to the other's, keeps each point's distance off the skin,
   and takes the new body's weights.
5. Compress each file: `gltf-transform resize --width 1024`, then `webp
   --quality 85`. That comes to about 350 KB.

Check every body before you add it to `bodies`. A body whose own mesh has bulky
clothes baked in will show the garment through them. Theo's denim jacket does
this, so the tech jacket is not made for Theo; he needs a base body first.

## An accessory

1. Get the picture: one object, three-quarter view, plain background.
2. Run `sam_3_3d` on it.
3. Run `gltf-transform simplify` (`--ratio 0.12 --error 0.01` for a hat), then
   `quantize`. Keep it under 400 KB; `tests/wardrobe.test.js` holds the line.
4. Add the entry with a `fit`: `feet`, `back`, `crown` or `eyes`. `tune` nudges
   it:
   - `size` is the fraction of head length (or foot or back length).
   - `along` is how far up the bone it sits.
   - `fwd` moves it forward.
   - `brim:true` turns a cap's longest horizontal axis to face front.

## Adding it to the game

One entry in `ITEMS` in `public/wardrobe.js`:

```js
'tech-jacket': { name:'Techwear jacket', slot:'outer', kind:'garment',
                 hides:['upperArms', 'forearms'], bodies:['robin', 'nia', ...], about:'...' },
```

Then run `npm test`. `tests/wardrobe.test.js` checks that every file the
catalog names exists, that each garment's files match its `bodies` list, and
that nothing is too heavy.

## The fitting room

```
node "glb files/wardrobe/lab.mjs" try <body> "outer:tech-jacket,shoes:skyline-shoes,head:cap" work/out.jpg walk 0.4
HEAD=1 node ... try ...     # the head, for hats and glasses
CHEST=1 node ... try ...    # the chest, for collars and seams
```

This is the game's own `avatar.js` and `wardrobe.js`, with the body in a clip at
a moment and four views. It prints what is worn and where its bounding box sits.
Look at every body in walk, sprint and kneel before shipping.
