import pg from "pg";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS opflow_connections (
  workflow_name TEXT NOT NULL,
  node_name TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workflow_name, node_name, integration_id)
)`;

/**
 * Ensure the opflow_connections table exists.
 * Creates a short-lived connection, runs the DDL, then closes it.
 */
export async function ensureConnectionsTable(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(CREATE_TABLE_SQL);
  } finally {
    await client.end();
  }
}
