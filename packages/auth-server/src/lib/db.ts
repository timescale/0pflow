import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new pg.Pool({ connectionString, max: 10 });
  }
  return pool;
}

/**
 * Create the required tables if they don't exist.
 */
export async function ensureSchema(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id TEXT UNIQUE NOT NULL,
      github_login TEXT NOT NULL,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cli_auth_sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      secret TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      user_id TEXT REFERENCES users(id),
      session_token TEXT UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes for lookups
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cli_sessions_code ON cli_auth_sessions(code)
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_cli_sessions_token ON cli_auth_sessions(session_token)
  `);
}
