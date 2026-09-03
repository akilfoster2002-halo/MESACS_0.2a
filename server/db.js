/* Postgres access + schema. Deliberately stores as little about a child as
   possible: a username they choose, a hashed password, and progress.
   No email, no real name, no date of birth.

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
    CREATE TABLE IF NOT EXISTS messages (
      id        SERIAL PRIMARY KEY,
      class_id  INTEGER REFERENCES classes(id),
      user_id   INTEGER REFERENCES users(id),
      display   TEXT NOT NULL,
      text      TEXT NOT NULL,
      hidden    BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS messages_class_idx ON messages(class_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS seen (id INT);

    /* --- servers replace classes as the room a message belongs to --- */
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS server TEXT;
    CREATE INDEX IF NOT EXISTS messages_server_idx ON messages(server, created_at DESC);
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
