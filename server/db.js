/* Postgres access + schema. Deliberately stores as little about a child as
   possible: a username they choose, a hashed password, a class, and progress.
   No email, no real name, no date of birth. */
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
  `).then(()=>{ state.ready=true; });
}
module.exports = { pool, init, state,
  get ready(){ return state.ready; },
  q:(text,params)=>{
    if(!state.ready) return Promise.reject(new Error('NO_DB'));
    return pool.query(text,params);
  } };
