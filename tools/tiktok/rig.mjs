/* The filming rig for short vertical clips of KORO, recorded out of the real
   game running under `npm run dev` (port 8799, signed in as Local Dev).

   Nothing here ships. Two things make it possible:

   - TIME IS OURS. performance.now, Date.now and requestAnimationFrame are
     replaced before the game loads, so the game only moves when step() says
     so and every frame is rendered in full, however slow the machine.
   - THE PLAYER IS REACHABLE. planet.js keeps `me` private; as it is served
     to this browser only, a few getters are added before its final return,
     exposed as window.__P. The file on disk is untouched. */

import puppeteer from 'puppeteer-core';

export const W = 1080, H = 1920;

const CLOCK = `(() => {
  let now = 0; const t0 = Date.now(); let q = [];
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { now += ms; const run = q; q = []; for (const cb of run) { try { cb(now); } catch (e) { console.error(e); } } };
  window.__freeRun = true;
  // until filming starts the clock runs by itself, so loading and menus work
  (function tick() { if (window.__freeRun) window.__step(16.7); setTimeout(tick, 16); })();
})();`;

const EXPOSE = `
  window.__P = { get me(){ return me; }, get mecha(){ return mecha; }, get W(){ return W; }, get PR(){ return PR; },
    get swimming(){ return swimming; }, get flying(){ return flying; }, get piloting(){ return piloting; },
    pilotMech:()=>pilotMech(), takeOff:()=>takeOff(), land:()=>land(), floorAt, terrainH, dirOf, frameAt,
    use:(id)=>use(id) };
`;

export async function open({ headless = true } = {}) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W / 2, height: H / 2, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text().slice(0, 300)); });
  await page.evaluateOnNewDocument(CLOCK);
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    if (!/\/planet\.js(\?|$)/.test(req.url())) return req.continue();
    const src = await (await fetch(req.url())).text();
    const at = src.lastIndexOf('  return { enter, tick, walk, use');
    if (at < 0) { console.error('rig: planet.js return not found'); return req.continue(); }
    req.respond({ status: 200, contentType: 'application/javascript', body: src.slice(0, at) + EXPOSE + src.slice(at) });
  });
  await page.goto('http://localhost:8799/', { waitUntil: 'networkidle2', timeout: 120000 });
  return { browser, page };
}

/* START, then wait until the planet is live and the player exists. */
export async function start(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /start/i.test(b.textContent) && b.offsetParent), { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /start/i.test(b.textContent) && b.offsetParent).click());
  try {
    await page.waitForFunction(() => window.__P && window.__P.me && window.__P.me.dir && typeof G !== 'undefined' && G.running, { timeout: 40000 });
  } catch (e) {
    console.error('rig: not live yet', await page.evaluate(() => ({ P: !!window.__P, dir: !!(window.__P && __P.me && __P.me.dir),
      G: typeof G !== 'undefined', running: typeof G !== 'undefined' && G.running, room: typeof G !== 'undefined' && G.room,
      shown: [...document.querySelectorAll('[id]')].filter((e) => e.offsetParent && getComputedStyle(e).position === 'fixed').map((e) => e.id).slice(0, 20) })));
    await page.screenshot({ path: '/tmp/claude-probe.jpg', type: 'jpeg', quality: 70 });
    throw e;
  }
}

/* From here on the game moves only when told to. */
export const hold = (page) => page.evaluate(() => { window.__freeRun = false; });
export const step = (page, frames = 1, fps = 30) => page.evaluate((n, ms) => { for (let i = 0; i < n; i++) window.__step(ms); }, frames, 1000 / fps);
export const keys = (page, down) => page.evaluate((d) => { for (const k in d) G.keys[k] = d[k]; }, down);

/* The tidy frame: the game's HUD off, nothing over the picture but the world. */
export const clean = (page, on = true) => page.evaluate((on) => {
  let s = document.getElementById('__clean');
  if (!s) { s = document.createElement('style'); s.id = '__clean'; document.head.appendChild(s); }
  s.textContent = on ? 'body > *:not(#view):not(canvas):not(.__keep):not(#neonPlay){ visibility:hidden !important } #view{ visibility:visible !important }' : '';
}, on);
