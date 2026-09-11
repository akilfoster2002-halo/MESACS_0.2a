/* Postgres access + schema. Deliberately stores as little about a child as
   possible: a username they choose, a hashed password, and progress.
   No email, no real name, no date of birth — and no chat, which is held in
   memory only and vanishes with the room.

   Rooms used to be classes, which meant a teacher had to build one before
   any two students could stand together. They are plain named servers now.
   The classes table and the class_id columns are left alone rather than
   dropped: there is live data behind them, and an additive migration cannot
   lose anything. New rows simply leave them null and set `server`. */
const { Pool } = require('pg');

const HAS_DB = !!process.env.DATABASE_URL;
const pool = HAS_DB ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
}) : null;
const state = { ready:false };

async function init(){
  // no database yet? still serve the game - sign-in simply reports it is offline
  if(!HAS_DB){ console.warn('DATABASE_URL not set: running without accounts'); return; }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id        SERIAL PRIMARY KEY,
      code      TEXT UNIQUE NOT NULL,
      name      TEXT NOT NULL,
      teacher_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT UNIQUE NOT NULL,
      pass_hash  TEXT NOT NULL,
      salt       TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'student',
      display    TEXT NOT NULL,
      class_id   INTEGER REFERENCES classes(id),
      progress   JSONB NOT NULL DEFAULT '{}'::jsonb,
      muted_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS seen (id INT);

    /* ------------------------------------------------------- the arcade
       The one thing in this game a child makes that OTHER children read.

       Chat is deliberately never written down — a room that empties forgets
       every word of it — and that is the right call for something said in
       passing. A game is the opposite: the whole point is that it outlives
       the lesson and somebody else finds it. So it is stored, and because
       it is stored it needs the things stored child-made work needs: an
       author, a way for a teacher to take it down, and a size it cannot
       exceed.

       The project column is the same JSON the editor already keeps in
       localStorage —
       actors, variables, lists, custom blocks, messages. Storing it whole
       means a published game is exactly the project that was played, and
       loading one is the same code path as loading your own. */
    CREATE TABLE IF NOT EXISTS games (
      id         SERIAL PRIMARY KEY,
      author_id  INTEGER NOT NULL REFERENCES users(id),
      title      TEXT NOT NULL,
      blurb      TEXT NOT NULL DEFAULT '',
      stage      TEXT NOT NULL DEFAULT 'world',
      project    JSONB NOT NULL,
      plays      INTEGER NOT NULL DEFAULT 0,
      hidden     BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    /* ONE VOTE PER PLAYER PER GAME, which the primary key enforces rather
       than the code: changing your mind edits your rating instead of adding
       a second one, and nobody can sit on a cabinet pushing a game up. */
    CREATE TABLE IF NOT EXISTS game_votes (
      game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      stars      INTEGER NOT NULL,
      note       TEXT NOT NULL DEFAULT '',
      hidden     BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (game_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS games_open ON games (hidden, updated_at DESC);

    /* Chat is not a table any more. It lives in the server's memory for as
       long as somebody is standing in the room and is thrown away the moment
       the room empties, so there is nothing here to create. An older messages
       table is left where it is rather than dropped — same reason as classes. */

    /* a class used to be required at sign-up; nobody has one now */
    ALTER TABLE users ALTER COLUMN class_id DROP NOT NULL;
  `).then(()=>{ state.ready=true; });
}
module.exports = { pool, init, state,
  get ready(){ return state.ready; },
  q:(text,params)=>{
    if(!state.ready) return Promise.reject(new Error('NO_DB'));
    return pool.query(text,params);
  } };
