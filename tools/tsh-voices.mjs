#!/usr/bin/env node
/* =====================================================================
   TSH — THE VOICES. Every line anybody speaks in the night, recorded.

   The lines live in public/tsh.js (LINES, the deal's and the flat's
   conversations, Robin's answers, the barks). This finds every one of
   them, says which voice speaks it and what the voice is actually given
   to read, and keeps public/tshvoice.js — the list the game plays from.

   A recording is named by who says the line and exactly what they say
   (the same FNV-1a hash tsh.js's vkey() makes), so editing a line in
   tsh.js leaves the old recording orphaned and the new words silent
   until they are recorded: the game never plays words that are not on
   the screen.

     node tools/tsh-voices.mjs todo           the lines with no recording yet, as JSON
     node tools/tsh-voices.mjs fetch FILE     FILE: [{ key, url }] — download, mono, 64k, into public/tsh/voice/
     node tools/tsh-voices.mjs manifest       rewrite public/tshvoice.js from what is on disk

   THE RECORDING ITSELF is done by Higgsfield (text2speech_v2, the
   ElevenLabs engine, one preset voice per person below): it is a paid
   service behind an MCP tool, not something a script here can call.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public', 'tsh.js');
const DIR = path.join(ROOT, 'public', 'tsh', 'voice');
const OUT = path.join(ROOT, 'public', 'tshvoice.js');

/* WHO SOUNDS LIKE WHAT. Higgsfield preset voices (list_voices). */
export const CAST = {
  robin:     { name:'Ainsley', id:'731b4ffe-e95e-59f4-8c00-81608936091f' },   // young, quick, a lot of range
  kai:       { name:'Dylan',   id:'b847bc29-f184-583a-8ad9-d1f1e16d1a60' },   // young man with a temper
  buyer:     { name:'Jasper',  id:'a7b8abe9-47f1-553e-a9df-87945a7e5bc8' },   // the buyer: on the phone, then in Dragon Alley with his crew (not Kai: Kai is not seen yet)
  dealer:    { name:'Jasper',  id:'a7b8abe9-47f1-553e-a9df-87945a7e5bc8' },   // the same man, in person (his name on the subtitle is THE BUYER)
  thug:      { name:'Knox',    id:'195e386a-cb61-5c1b-a53b-0e2f0669c408' },   // the one in the buyer's crew who gets back up
  maya:      { name:'Soraya',  id:'5c1d2f7f-cdb4-5b1d-bca9-156439e3275e' },   // low, level, never in a hurry
  mom:       { name:'Vera',    id:'0c51919f-0756-5f8d-8169-026a339d8fd7' },   // the Director: measured, on camera
  counselor: { name:'Holden',  id:'3c9d6053-6334-592c-8997-4e325286af3f' },   // the voicemail
  wfc:       { name:'Landon',  id:'dc1c0a41-53cd-53af-aec5-ab637840505f' }    // the deepest voice there is
};

/* What NPCs shout (tsh.js bark()), by who shouts it. Words only: a 📱 or a
   ✴ over somebody's head is not said out loud. */
const BARKS = {
  kai: ['Huh?', 'There you are.', 'Tch.', 'Where\'d she go…', 'Following me? Go home, kid.', 'Hey! That\'s—', 'There you are!', 'YU!',
        'You\'re mine.', '…Hey.', 'Evening.', 'Got you!', 'Not so fast.'],
  wfc: ['Shades off, kid.', 'Evening. Where you headed?', 'Keep it moving.', 'Stop! WFC!', 'Hold it right there!', 'Suspect on foot!', 'Hold still!']
};

export function vkey(who, text){
  let h = 0x811c9dc5; const s = who + '|' + text;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}

/* What the voice is given to read: the words, without the stage
   directions, with YU spelled the way Kai spells it. */
export function spoken(text){
  if(text === '(laughs)') return 'Hah... ha ha. Haha!';
  if(text === '(groans)') return 'Ughhh...';
  return text.replace(/^\([^)]*\)\s*/, '').replace(/\bYU\b/g, 'Y-U').trim();
}

const unq = s => s.replace(/\\(.)/g, '$1');
export function lines(src){
  const found = new Map();
  const add = (who, text) => {
    if(!CAST[who] || !text || /^📱/.test(text) || !/[a-z]/i.test(text)) return;
    if(CAST[text] || text === 'text') return;                 // ['kai','maya'] is a list of names, ['kai', 'text'] a comment
    const k = vkey(who, text); if(!found.has(k)) found.set(k, { key:k, who, text, tts:spoken(text), voice:CAST[who].id });
  };
  const Q = `'((?:[^'\\\\]|\\\\.)*)'`;
  for(const m of src.matchAll(new RegExp(`\\[\\s*'(robin|kai|buyer|dealer|thug|maya|mom|counselor|wfc|vendor)'\\s*,\\s*${Q}\\s*\\]`, 'g'))) add(m[1], unq(m[2]));
  for(const m of src.matchAll(new RegExp(`\\bsay:\\s*${Q}`, 'g'))) add('robin', unq(m[1]));
  for(const [who, list] of Object.entries(BARKS)) list.forEach(t=>{ if(src.includes(t.replace(/'/g, '\\\''))) add(who, t); });
  return [...found.values()];
}

function duration(f){
  const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
  return Math.round(parseFloat(out)*100)/100;
}

/* the command line — only when run, not when a test imports the line list */
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href){
  const cmd = process.argv[2];
  const all = lines(fs.readFileSync(SRC, 'utf8'));
  fs.mkdirSync(DIR, { recursive:true });
  const have = k => fs.existsSync(path.join(DIR, k + '.mp3'));

  if(cmd === 'todo'){
    process.stdout.write(JSON.stringify(all.filter(l=>!have(l.key)), null, 1) + '\n');
  } else if(cmd === 'fetch'){
    const jobs = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    for(const j of jobs){
      const raw = path.join(DIR, j.key + '.raw');
      const r = await fetch(j.url); if(!r.ok){ console.error('failed', j.key, r.status); continue; }
      fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      // mono, 64k, and the silence the engine leaves at the front trimmed off
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,apad=pad_dur=0.05',
        '-ac', '1', '-ar', '32000', '-b:a', '64k', path.join(DIR, j.key + '.mp3')]);
      fs.unlinkSync(raw);
      console.log('ok', j.key);
    }
  } else if(cmd === 'manifest'){
    const keep = {}, keys = new Set(all.map(l=>l.key));
    all.forEach(l=>{ if(have(l.key)) keep[l.key] = duration(path.join(DIR, l.key + '.mp3')); });
    const orphans = fs.readdirSync(DIR).filter(f=>f.endsWith('.mp3') && !keys.has(f.slice(0, -4)));
    const sorted = Object.fromEntries(Object.keys(keep).sort().map(k=>[k, keep[k]]));
    fs.writeFileSync(OUT, `/* TSH — the recorded lines: key (tsh.js vkey: who + what they say) → seconds.
     Written by tools/tsh-voices.mjs manifest; do not edit by hand. Voices: ${Object.entries(CAST).map(([w, c])=>w + ' ' + c.name).join(', ')}. */
  window.TSHVOICE = { lines:${JSON.stringify(sorted)} };
  `);
    console.log(`${Object.keys(keep).length}/${all.length} lines recorded` + (orphans.length ? ` · ${orphans.length} orphaned: ${orphans.join(' ')}` : ''));
  } else {
    console.log('usage: tsh-voices.mjs todo | fetch FILE | manifest');
  }
}
