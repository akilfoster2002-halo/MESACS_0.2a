/* =====================================================================
   THE ENVIRONMENT, under test.

   Two things, and the first one is not really about code.

   A KEY MUST NEVER REACH THE REPOSITORY. `.env` holds an API key and a
   database URL on somebody's laptop. It is one `git add -A` from being
   in the history for ever, and a key in a git history is a key that has
   to be rotated, not deleted. So the ignore rule is tested, both ways
   round: `.env` ignored, `.env.example` not — because the template is
   the whole point of having one and silently ignoring it would leave
   nobody knowing what to fill in.

   AND A REAL ENVIRONMENT VARIABLE ALWAYS WINS. On Render the names come
   from the dashboard and there is no file. A stray .env left on a server
   must not be able to override that quietly — that is how a laptop's key
   ends up talking to a production database.
   ===================================================================== */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname,'..');
const P = f => path.join(ROOT, f);
const read = f => fs.readFileSync(P(f),'utf8');
const env = require('../server/env.js');

const ignored = f => {
  try{ execFileSync('git',['check-ignore','-q','--no-index',f],{ cwd:ROOT }); return true; }
  catch(e){ return false; }
};

/* ==================================================================== */
test('a .env can never be committed, and the template always can', ()=>{
  assert.ok(ignored('.env'),
    '.env is not git-ignored — an API key is one `git add -A` from being in the history for ever');
  ['.env.local','.env.production','.env.anything'].forEach(f=>
    assert.ok(ignored(f), f+' is not ignored'));
  assert.ok(!ignored('.env.example'),
    '.env.example is ignored, so nobody cloning this knows what to fill in');
});

test('the committed template holds names and no values', ()=>{
  const lines=read('.env.example').split('\n')
    .map(l=>l.trim()).filter(l=>l && l[0]!=='#');
  assert.ok(lines.length, 'the template names nothing');
  lines.forEach(l=>{
    const [k,...rest]=l.split('=');
    assert.strictEqual(rest.join('=').trim(), '',
      '.env.example has a value against '+k+' — the template is not a place for one');
  });
});

test('the template names every variable the server actually reads', ()=>{
  /* A template that has gone stale is worse than none: somebody fills it
     in, the thing still does not work, and there is nothing to tell them
     which name they are missing. */
  const src=['server/index.js','server/db.js','server/auth.js','server/tutor.js',
             'tools/dev-server.js'].map(read).join('\n');
  const used=new Set([...src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(m=>m[1]));
  /* NODE_ENV is the runtime's own and is never set by hand; the auth
     token is the CLI's alternative to a key and is not something a
     school would put in a file. */
  ['NODE_ENV','ANTHROPIC_AUTH_TOKEN'].forEach(k=>used.delete(k));
  const named=read('.env.example');
  [...used].sort().forEach(k=>assert.ok(named.indexOf(k)>=0,
    '.env.example never mentions '+k+', which the server reads'));
});

/* ------------------------------------------------------- the loader */
function withFile(body, run){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'koro-env-'));
  const file=path.join(dir,'.env');
  fs.writeFileSync(file, body);
  try{ return run(file); } finally { fs.rmSync(dir,{ recursive:true, force:true }); }
}

test('a real environment variable always wins over the file', ()=>{
  const KEY='KORO_TEST_PRECEDENCE';
  process.env[KEY]='from-the-real-environment';
  try{
    withFile(KEY+'=from-the-file\n', f=>env.load(f));
    assert.strictEqual(process.env[KEY], 'from-the-real-environment',
      'a stray .env overrode a real variable — that is how a laptop key reaches production');
  } finally { delete process.env[KEY]; }
});

test('the file fills in only what is missing', ()=>{
  const KEY='KORO_TEST_FILLS_IN';
  delete process.env[KEY];
  try{
    const r=withFile(KEY+'=from-the-file\n', f=>env.load(f));
    assert.strictEqual(process.env[KEY], 'from-the-file');
    assert.ok(r.names.indexOf(KEY)>=0, 'the loader does not report what it set');
  } finally { delete process.env[KEY]; }
});

test('a blank line in the template is not a value', ()=>{
  /* .env.example ships with `ANTHROPIC_API_KEY=` against every name. A
     student who copies it and fills in one of them must not end up with
     the other names set to empty strings that then read as "configured". */
  const KEY='KORO_TEST_BLANK';
  delete process.env[KEY];
  withFile(KEY+'=\n', f=>env.load(f));
  assert.strictEqual(process.env[KEY], undefined,
    'an empty line in the template was loaded as a set-but-empty variable');
});

test('no file at all is the normal case, not an error', ()=>{
  const r=env.load(path.join(os.tmpdir(),'koro-nothing-here-'+Date.now(),'.env'));
  assert.strictEqual(r.loaded, false);
  assert.deepStrictEqual(r.names, []);
});

test('it reads the .env files people actually write', ()=>{
  const got=env.parse([
    '# a comment',
    '',
    'PLAIN=value',
    'export EXPORTED=yes',            // half the .env files in the world
    'QUOTED="hello world"',
    "SINGLE='one two'",
    'TRAILING=value # not part of it',
    'HASHY="value # kept"',           // quoted, so the hash is the value's
    'SPACED = spaced out ',
    'not-a-line',
    '9BAD=x'
  ].join('\n'));
  assert.strictEqual(got.PLAIN,    'value');
  assert.strictEqual(got.EXPORTED, 'yes');
  assert.strictEqual(got.QUOTED,   'hello world');
  assert.strictEqual(got.SINGLE,   'one two');
  assert.strictEqual(got.TRAILING, 'value');
  assert.strictEqual(got.HASHY,    'value # kept');
  assert.strictEqual(got.SPACED,   'spaced out');
  assert.ok(!('9BAD' in got), 'a name that is not a name was accepted');
});

test('a key pasted with quotes round it is still the key', ()=>{
  /* Copying out of a dashboard often brings the quotes along. */
  assert.strictEqual(env.parse('ANTHROPIC_API_KEY="sk-ant-abc"\n').ANTHROPIC_API_KEY, 'sk-ant-abc');
});

test('the file is read before anything reads what is in it', ()=>{
  /* db.js reads DATABASE_URL at load time and tutor.js reads the key at
     load time. A .env loaded any later than the first require is a .env
     that did nothing at all. */
  const src=read('server/index.js');
  const loadAt=src.indexOf("require('./env')");
  assert.ok(loadAt>=0, 'server/index.js never loads the .env');
  ["require('./db')","require('./tutor')","require('./auth')"].forEach(r=>{
    const at=src.indexOf(r);
    if(at>=0) assert.ok(loadAt<at, 'the .env is loaded after '+r+', which reads it at load time');
  });
  assert.match(read('tools/dev-server.js'), /require\('\.\.\/server\/env'\)/,
    'npm run dev does not read the .env, so a key that works in production does not work locally');
});
