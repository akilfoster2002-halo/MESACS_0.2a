#!/usr/bin/env node
/* =====================================================================
   One version number, moved by one.

   Every script tag in public/index.html carries `?v=N`, and so does
   window.ASSETV, which is what the models and textures are fetched with.
   They have to be the same N or a deploy is half the old game.

   They have drifted before, more than once, and always the same way: a
   `sed s/v=340/v=341/` moves the forty-one script tags and cannot see
   `window.ASSETV='340'`, because that line does not contain "v=". The
   models then stay on whatever version they were cached at while the code
   moves on — which shows up as a model that will not reload after it has
   been changed, and looks like a bug in the model.

   So neither number is edited by hand any more.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* EVERY PAGE, not just the game's. There are two documents now — the game
   and the standalone Pong — and they share app.css and most of their
   scripts. Bumping one and not the other hands a browser a new stylesheet
   on one page and last week's on the other, which is a bug that only shows
   up on the machine that happens to have the old file cached. index.html
   is still the one that carries ASSETV. */
const PAGES = ['index.html', 'pong.html']
  .map(f => path.join(__dirname, '..', 'public', f))
  .filter(fs.existsSync);
const PAGE = PAGES[0];

function main(){
  const src = fs.readFileSync(PAGE, 'utf8');

  const tags = [...src.matchAll(/\?v=(\d+)/g)].map(m => +m[1]);
  const assetv = src.match(/window\.ASSETV\s*=\s*'(\d+)'/);
  if(!tags.length) throw new Error('public/index.html has no ?v= tags');
  if(!assetv)      throw new Error('public/index.html no longer sets ASSETV');

  const seen = [...new Set(tags.concat(+assetv[1]))];
  const next = Math.max(...seen) + 1;
  if(seen.length > 1)
    console.log(`(they had drifted apart: ${seen.sort((a,b)=>a-b).join(', ')})`);

  let files = 0;
  for(const page of PAGES){
    const one = fs.readFileSync(page, 'utf8');
    const out = one.replace(/\?v=\d+/g, '?v=' + next)
                   .replace(/window\.ASSETV\s*=\s*'\d+'/, `window.ASSETV='${next}'`);
    if(out !== one || /\?v=\d+/.test(one)) files++;
    fs.writeFileSync(page, out);
  }
  console.log(`v=${next} — ${tags.length} tags in index.html, ${files} page(s) written`);
}
main();
