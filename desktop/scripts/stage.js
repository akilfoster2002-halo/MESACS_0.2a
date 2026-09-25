#!/usr/bin/env node
/* Copies the game into desktop/game/ so the app carries the very same
   files the website serves — public/, server/, flightschool/ — and nothing
   else. In particular NOT the repo's .env: it holds the real database URL
   and API keys, and none of that belongs in a file handed to students. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, '..', 'game');
fs.rmSync(out, { recursive:true, force:true });
for (const dir of ['public', 'server', 'flightschool'])
  fs.cpSync(path.join(root, dir), path.join(out, dir), { recursive:true,
    filter: src => !/(^|\/)\.env(\..*)?$/.test(src) && !src.endsWith('.DS_Store') });
/* the Chat Rooms catalogue lives with the game that builds from it, and
   server/chatrooms.js reads it from there (../koro-godot/data): without it
   the app's own server would switch chat rooms off */
fs.mkdirSync(path.join(out, 'koro-godot', 'data'), { recursive:true });
fs.copyFileSync(path.join(root, 'koro-godot', 'data', 'chatrooms.json'), path.join(out, 'koro-godot', 'data', 'chatrooms.json'));
if (fs.existsSync(path.join(out, 'server', '.env'))) throw new Error('.env must not be staged');
console.log('staged the game into', out);
