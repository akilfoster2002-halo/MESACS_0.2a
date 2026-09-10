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

const PAGE = path.join(__dirname, '..', 'public', 'index.html');

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

  const out = src.replace(/\?v=\d+/g, '?v=' + next)
                 .replace(/window\.ASSETV\s*=\s*'\d+'/, `window.ASSETV='${next}'`);
  fs.writeFileSync(PAGE, out);
  console.log(`v=${next} — ${tags.length} script tags and ASSETV`);
}
main();
