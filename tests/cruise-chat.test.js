/* TALKING WHILE YOU FLY.

   The run between the planets is the longest stretch in this game with
   nothing to do but hold W, which makes it the place a class most wants
   to talk — and the one place chat did not work. cruise.js has called
   CHAT.show() the whole time; it had just never put anything on screen,
   because #chat lives inside #hud and the ride hid #hud whole. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the chat is inside the HUD, which is why hiding it whole took the chat', ()=>{
  const html = read('public/index.html');
  const at = html.indexOf('<div id="hud"');
  assert.ok(at >= 0, 'there is no #hud');
  let depth = 0, i = at, end = at;
  while(i < html.length){
    if(html.startsWith('<div', i)) depth++;
    else if(html.startsWith('</div>', i)) depth--;
    if(depth === 0 && i > at){ end = i; break; }
    i++;
  }
  /* If somebody ever moves #chat out of #hud this test is what tells them
     cruise.js can go back to hiding the container. */
  assert.ok(html.slice(at, end).includes('id="chat"'),
    '#chat is no longer inside #hud — cruise.js can stop hiding children one by one');
});

test('the ride hides the HUD piece by piece, and puts back what it found', ()=>{
  const src = read('public/cruise.js');
  assert.doesNotMatch(src, /querySelector\('#hud'\)\.classList\.add\('hidden'\)/,
    'the ride hides the whole HUD again, which takes the chat with it');
  assert.match(src, /hudEl\.classList\.remove\('hidden'\)/, 'the HUD container is not opened');
  assert.match(src, /if\(el\.id==='chat'\) return;/, 'the chat is not being kept');
  /* Several of those children were already hidden before the launch, and
     turning them all on at the end hands the planet a health bar it is
     not using. */
  assert.match(src, /hudWas\.push\(\[el, el\.classList\.contains\('hidden'\)\]\)/,
    'what each piece looked like before the launch is not remembered');
  assert.match(src, /hudWas\.forEach\(\(\[el,was\]\)=>el\.classList\.toggle\('hidden', was\)\)/,
    'the pieces are not put back as they were found');
});

test('a keystroke aimed at the chat belongs to the chat', ()=>{
  const src = read('public/cruise.js');
  /* onKey is bound on the CAPTURE phase, so it sees every key first. The
     letters that fly the ship are exactly the ones it calls
     preventDefault on — so without a guard the input never receives them
     and you cannot type the word "wait". */
  assert.match(src, /window\.addEventListener\('keydown', onKey, true\)/,
    'the ride no longer captures keys — this test is about the case where it does');
  assert.match(src, /function onKey\(e\)\{[\s\S]{0,1400}typingInField\(e\)\)\{/,
    'the ride does not check whether you are typing');
  /* And nothing may stay held down while you type, or a W typed as the
     first letter of a word leaves the engines on. */
  assert.match(src, /for\(const k in keys\) keys\[k\]=false;/,
    'keys stay held while you type');
  /* Escape gets you out of the box, not out of the flight. */
  assert.match(src, /typingInField\(e\)\)\{[\s\S]{0,300}Escape[\s\S]{0,120}blur\(\)/,
    'Escape while typing still aborts the flight');
  const guard = src.indexOf('typingInField(e)');
  const abort = src.indexOf("e.code==='Escape'){ abort(); return; }");
  assert.ok(guard >= 0 && abort > guard,
    'the abort on Escape runs before the typing guard');
});
