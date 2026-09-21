/* =====================================================================
   ENV — the .env file, read without a dependency.

   Everything the server can be told is an environment variable, because
   that is what Render hands it. On a laptop there is no dashboard to put
   them in, so there is a file instead, and this reads it.

   TWO RULES, and the first one is the one that matters:

   A REAL ENVIRONMENT VARIABLE ALWAYS WINS. This only ever fills in names
   that are not already set. A stray .env left on a server must not be
   able to quietly override what the dashboard says — that is how a
   staging key ends up talking to a production database, and it is the
   sort of thing nobody finds until it has already happened.

   AND A MISSING FILE IS NORMAL, not an error. In production there is no
   file at all; every one of these names is optional anyway, and the game
   runs with none of them set — it just runs with less of itself switched
   on.

   No dotenv. It is forty lines to do this properly and the rest of this
   server writes its own password hashing with node's crypto rather than
   take a dependency; a parser for KEY=VALUE is not where that changes.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* KEY=VALUE, one per line. Comments and blanks are skipped, `export ` is
   tolerated because half the .env files in the world have it, and quotes
   around a value are stripped — a key pasted out of a dashboard often
   arrives wrapped in them and the quotes are not part of the key. */
function parse(text){
  const out = {};
  String(text).split(/\r?\n/).forEach(line=>{
    const s = line.trim();
    if(!s || s[0]==='#') return;
    const eq = s.indexOf('=');
    if(eq < 1) return;
    const key = s.slice(0, eq).replace(/^export\s+/, '').trim();
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
    let val = s.slice(eq+1).trim();
    const quoted = (val[0]==='"' && val.endsWith('"')) || (val[0]==="'" && val.endsWith("'"));
    if(quoted) val = val.slice(1,-1);
    /* An unquoted trailing comment is a comment. A quoted one is part of
       the value, which is why this happens after the quote check. */
    else { const hash = val.indexOf(' #'); if(hash>=0) val = val.slice(0,hash).trim(); }
    out[key] = val;
  });
  return out;
}

function load(file){
  file = file || path.join(__dirname, '..', '.env');
  let text = null;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch(e){ return { loaded:false, names:[] }; }      // no file is the normal case
  const vars = parse(text);
  const names = [];
  Object.keys(vars).forEach(k=>{
    if(process.env[k] !== undefined && process.env[k] !== '') return;   // the real one wins
    if(vars[k] === '') return;                        // an empty line in the template is not a value
    process.env[k] = vars[k];
    names.push(k);
  });
  return { loaded:true, names };
}

module.exports = { load, parse };
