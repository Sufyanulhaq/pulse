import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, backup } from 'node:sqlite'

const MIGRATIONS = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    token_digest TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    user_agent TEXT
  );
  CREATE TABLE login_attempts (
    email TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    locked_until INTEGER
  );
  CREATE TABLE settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL
  );
  CREATE TABLE focus_sessions (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    minutes REAL NOT NULL,
    planned INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '',
    interruptions INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  );
  CREATE INDEX focus_sessions_user_start ON focus_sessions(user_id, start);
  CREATE TABLE api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_digest TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  );
  CREATE TABLE webhook_endpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE webhook_deliveries (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER,
    last_status INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (endpoint_id, event_id)
  );
  CREATE INDEX webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at);
  CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE team_members (
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );
  CREATE TABLE assistant_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    citations TEXT NOT NULL,
    answerable INTEGER NOT NULL,
    mode TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX assistant_messages_user ON assistant_messages(user_id, created_at);
  `,
  `
  ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
  ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
  ALTER TABLE users ADD COLUMN plan_status TEXT;
  ALTER TABLE users ADD COLUMN plan_interval TEXT;
  ALTER TABLE users ADD COLUMN plan_seats INTEGER;
  ALTER TABLE users ADD COLUMN plan_period_end INTEGER;
  ALTER TABLE users ADD COLUMN plan_cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
  ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
  CREATE UNIQUE INDEX users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
  CREATE TABLE email_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    token_digest TEXT NOT NULL UNIQUE,
    data TEXT,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX email_tokens_user ON email_tokens(user_id, kind);
  CREATE TABLE stripe_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at INTEGER NOT NULL
  );
  CREATE TABLE email_log (
    id TEXT PRIMARY KEY,
    to_address TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at INTEGER NOT NULL
  );
  `,
]

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  const version = db.prepare('PRAGMA user_version').get().user_version
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  return db
}

/**
 * Copy the live database to `path` without stopping writes, using SQLite's
 * online backup. Safe to run while the server is busy.
 */
export async function backupTo(db, path) {
  mkdirSync(dirname(path), { recursive: true })
  await backup(db, path)
  return path
}

/** Run `fn` inside a transaction; everything is saved or nothing is. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
