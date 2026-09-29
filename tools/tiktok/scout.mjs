/* node scout.mjs <file.js> — runs the file's setup in the page, then snaps.
   The file is an async function body with (step, snap) in scope. */
import fs from 'node:fs';
import { open, start, hold, step, clean } from './rig.mjs';
const body = fs.readFileSync(process.argv[2], 'utf8');
const { browser, page } = await open();
try {
  await start(page);
  await step(page, 60);
  await page.evaluate(() => { const s = [...document.querySelectorAll('a,button')].find((b) => /skip the walkthrough/i.test(b.textContent)); if (s) s.click(); });
  await hold(page);
  await clean(page);
  let n = 0;
  const api = {
    step: (f) => step(page, f),
    js: (fn, ...a) => page.evaluate(fn, ...a),
    snap: async (name) => { const p = `/tmp/scout-${name || n++}.jpg`; await page.screenshot({ path: p, type: 'jpeg', quality: 70 }); console.log('snap', p); },
  };
  await new Function('api', `return (async () => { const { step, js, snap } = api; ${body} })()`)(api);
} finally { await browser.close(); }
