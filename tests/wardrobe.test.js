/* THE WARDROBE (wardrobe.js, closet.js).

   Clothes are a catalog and some files: an entry that names a file that is
   not there is a hole in somebody's closet, and a garment listed for a body
   it was never fitted to puts a jacket in the wrong place on them. What you
   have on also travels — on every presence update, through the server — so
   the short code it travels as has to survive the trip both ways. And the
   pieces that hang off it (TSH dressing Robin, the closet opening from the
   quick change, other players arriving dressed) are one line each, easy to
   lose in a refactor. These checks fail loudly instead. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const exists = f => fs.existsSync(path.join(root, f));
const has = (text, re, msg) => assert.ok(re.test(text), msg || ('missing: ' + re));
// what comes out of the vm is from another realm: compare it as data
const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), msg);

/* wardrobe.js only reaches for THREE when it dresses a model, which these tests never do */
function wardrobe(saved){
  const store = new Map(saved ? [['dq_closet', JSON.stringify(saved)]] : []), bag = {};
  const localStorage = { getItem:k=>store.has(k) ? store.get(k) : null, setItem:(k, v)=>store.set(k, String(v)), removeItem:k=>store.delete(k) };
  const ctx = vm.createContext({ console, Math, JSON, Map, Set, Object, Array, String, Promise, localStorage });
  ctx.window = ctx;
  ctx.PROGRESS = { set:(k, v)=>{ bag[k] = JSON.parse(JSON.stringify(v)); }, get:(k, d)=>bag[k] === undefined ? d : bag[k] };
  vm.runInContext(read('public/wardrobe.js'), ctx, { filename:'wardrobe.js' });
  return { W:ctx.WARDROBE, store, bag };
}

test('every item has a slot that exists, and every file it names is there', ()=>{
  const { W } = wardrobe();
  const slots = new Set(W.SLOTS.map(s=>s.id));
  for(const [id, it] of Object.entries(W.ITEMS)){
    assert.ok(slots.has(it.slot), id + ' is in a slot that does not exist: ' + it.slot);
    assert.ok(['garment', 'accessory', 'made'].includes(it.kind), id + ' is neither garment, accessory nor made');
    (it.hides || []).forEach(r=>assert.ok(W.REGIONS.includes(r), id + ' hides a region the body does not have: ' + r));
    if(it.kind === 'accessory') assert.ok(exists('public/characters/wardrobe/' + it.model + '.glb'), id + ': no ' + it.model + '.glb');
    if(it.kind === 'made') assert.ok(it.make, id + ' is made in code but does not say how');
    if(it.kind === 'garment'){
      assert.ok(it.bodies && it.bodies.length, id + ' is a garment made for nobody');
      for(const b of it.bodies){
        assert.ok(exists('public/characters/models/character-' + b + '.glb'), id + ' is made for ' + b + ', who is not a character');
        assert.ok(exists('public/characters/wardrobe/' + id + '/' + b + '.glb'), id + ' says it fits ' + b + ' but there is no ' + id + '/' + b + '.glb');
      }
      const made = fs.readdirSync(path.join(root, 'public/characters/wardrobe', id)).filter(f=>f.endsWith('.glb')).map(f=>f.replace('.glb', ''));
      same(made.sort(), it.bodies.slice().sort(), id + ': the files and the list of bodies disagree');
    }
  }
});

test('nothing in the wardrobe is heavy enough to stall a try-on', ()=>{
  const dir = path.join(root, 'public/characters/wardrobe');
  const walk = d => fs.readdirSync(d, { withFileTypes:true }).flatMap(e=>e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for(const f of walk(dir).filter(f=>f.endsWith('.glb'))){
    const kb = fs.statSync(f).size/1024;
    assert.ok(kb < 400, path.relative(root, f) + ' is ' + Math.round(kb) + ' KB');
  }
});

test('a garment goes only on a body it was made for; anything else fits anybody', ()=>{
  const { W } = wardrobe();
  assert.ok(W.fits('tech-jacket', 'robin'));
  assert.ok(!W.fits('tech-jacket', 'theo'), 'the jacket was never fitted to Theo — his own coat is in the way');
  assert.ok(W.fits('cap', 'theo') && W.fits('skyline-shoes', 'theo'), 'accessories are for everybody');
  assert.strictEqual(W.wear('tech-jacket', 'theo'), false);
  same(W.on('theo'), {});
  W.setOn('theo', { outer:'tech-jacket', head:'cap', shoes:'cap' });
  same(W.on('theo'), { head:'cap' }, 'setOn drops what does not fit and what is in the wrong slot');
});

test('one thing to a slot: putting on a cap takes the beanie off', ()=>{
  const { W } = wardrobe();
  W.wear('beanie', 'nia'); W.wear('cap', 'nia'); W.wear('shades', 'nia');
  same(W.on('nia'), { head:'cap', face:'shades' });
  W.takeOff('head', 'nia');
  same(W.on('nia'), { face:'shades' });
  same(W.on('kofi'), {}, 'what Nia has on is Nia\'s');
});

test('an outfit is a saved set of slots, and wearing it puts back exactly that', ()=>{
  const { W, store, bag } = wardrobe();
  W.wear('tech-jacket', 'robin'); W.wear('skyline-shoes', 'robin');
  W.saveOutfit('night', 'robin');
  W.setOn('robin', {});
  W.wearOutfit('night', 'robin');
  same(W.on('robin'), { outer:'tech-jacket', shoes:'skyline-shoes' });
  assert.ok(JSON.parse(store.get('dq_closet')).outfits.night, 'kept in this browser');
  assert.ok(bag.closet && bag.closet.outfits.night, 'and in the progress bag, for the next machine');
  W.dropOutfit('night');
  same(Object.keys(W.outfits), []);
});

test('the closet comes back from the bag after sign-in, and wins over this browser', ()=>{
  const { W, bag } = wardrobe({ owned:[], on:{ nia:{ head:'beanie' } }, outfits:{} });
  same(W.on('nia'), { head:'beanie' });
  bag.closet = { owned:[], on:{ nia:{ head:'cap' } }, outfits:{ school:{ head:'cap' } } };
  let heard = 0; W.onChange(()=>heard++);
  W.restore();
  same(W.on('nia'), { head:'cap' });
  assert.ok(W.outfits.school);
  assert.ok(heard > 0, 'and anybody wearing it is told');
  has(read('public/game.js'), /load\(p\)\{ done=p\|\|\{\}; if\(window\.WARDROBE\) WARDROBE\.restore\(\)/, 'PROGRESS.load no longer hands the closet back to the wardrobe');
});

test('what you have on travels as a short code, and only real things come back out of it', ()=>{
  const { W } = wardrobe();
  const slots = { outer:'tech-jacket', shoes:'skyline-shoes', head:'cap' };
  const c = W.code(slots);
  assert.strictEqual(c, 'head:cap,outer:tech-jacket,shoes:skyline-shoes', 'sorted, so the same outfit is the same string');
  same(W.decode(c), slots);
  same(W.decode('head:crown,shoes:cap,outer:tech-jacket,,:'), { outer:'tech-jacket' }, 'unknown items and wrong slots are dropped');
  same(W.decode(null), {});
  // the server lets the code through only if it looks like one
  const m = read('server/index.js').match(/p\.fit\s*=\s*\(typeof m\.fit==='string' && (\/[^\n]*?\/)\.test\(m\.fit\)\)/);
  assert.ok(m, 'the server no longer checks `fit` before passing it on');
  const re = eval(m[1]);
  const every = {}; W.SLOTS.forEach(s=>{ const ids = W.itemsIn(s.id); if(ids.length) every[s.id] = ids.sort((a, b)=>b.length - a.length)[0]; });
  assert.ok(re.test(W.code(every)), 'the longest outfit there is would be turned away by the server: ' + W.code(every));
  assert.ok(!re.test('<script>'), 'and markup is turned away');
  has(read('public/wardrobe.js'), /const want = slots == null \? lookOf\(body\)/, 'somebody else in just the base layer ("") would be dressed in YOUR saved look');
});

test('a story dresses a body without touching what the player saved', ()=>{
  const { W } = wardrobe();
  W.wear('cap', 'robin');
  W.cast('robin', { outer:'tech-jacket' });
  same(W.lookOf('robin'), { outer:'tech-jacket' });
  same(W.on('robin'), { head:'cap' });
  W.cast('robin', null);
  same(W.lookOf('robin'), { head:'cap' });
});

test('Robin\'s kit in TSH is wardrobe items, and every one of them is in the catalog', ()=>{
  const { W } = wardrobe();
  const tsh = read('public/tsh.js');
  const m = tsh.match(/const KIT_ITEMS = (\{[^\n]*\});/);
  assert.ok(m, 'tsh.js no longer lists her kit as wardrobe items');
  const kit = eval('(' + m[1] + ')');
  for(const [piece, [slot, id]] of Object.entries(kit)){
    assert.ok(W.ITEMS[id], piece + ' is ' + id + ', which is not in the wardrobe');
    assert.strictEqual(W.ITEMS[id].slot, slot, piece + ' goes in ' + W.ITEMS[id].slot + ', not ' + slot);
    assert.ok(W.fits(id, 'robin'), piece + ' does not fit Robin');
  }
  has(tsh, /WARDROBE\.cast\('robin', kitSlots\(\)\)/, 'TSH no longer dresses Robin before her body arrives');
  has(tsh, /WARDROBE\.cast\('robin', null\)/, 'TSH no longer gives Robin her own clothes back when the night ends');
});

test('the closet is on the page, opens from the quick change, and has the keys while it is up', ()=>{
  const html = read('public/index.html');
  const at = f => html.indexOf('<script src="' + f);
  assert.ok(at('wardrobe.js') > at('avatar.js') && at('avatar.js') > 0, 'wardrobe.js has to load after avatar.js');
  assert.ok(at('closet.js') > at('chars.js') && at('chars.js') > 0, 'closet.js has to load after chars.js');
  for(const id of ['closet', 'closetView', 'closetTitle', 'closetTabs', 'closetRow', 'closetFits', 'closetHint'])
    has(html, new RegExp('id="' + id + '"'), 'the closet panel has lost #' + id);
  has(read('public/chars.js'), /k==='Tab' && window\.CLOSET\)\{ quickClose\(true\); CLOSET\.open\(\)/, 'TAB in the quick change no longer opens the closet');
  const game = read('public/game.js');
  has(game, /CLOSET\.up && CLOSET\.key\(e\)/, 'the game no longer hands keys to the closet while it is open');
  has(game, /window\.CLOSET && CLOSET\.up\)/, 'the game no longer freezes you while you get dressed');
});

test('you are dressed in what you chose, and everybody else arrives in what they chose', ()=>{
  const av = read('public/avatar.js');
  has(av, /WARDROBE\.put\(m, bodyOf\(chosen\)\)/, 'your own body is no longer dressed when it loads');
  has(av, /WARDROBE\.onChange\(/, 'your body no longer changes when the closet does');
  has(read('public/net.js'), /fit:WARDROBE\.code\(WARDROBE\.on\(p\.char\)\)/, 'presence no longer says what you have on');
  has(read('server/index.js'), /fit:p\.fit \|\| ''/, 'the server no longer passes on what people have on');
  for(const f of ['public/planet.js', 'public/neon.js', 'public/chatroom.js'])
    has(read(f), /dressOther\(o, p\.fit\)/, f + ' no longer dresses the other players');
});
