import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";
import pg from "pg";
import { createIntegrationProvider } from "../../../connections/integration-provider.js";
import { resolveConnectionId, upsertConnection } from "../../../connections/resolver.js";
import type { ConnectionCredentials } from "../../../types.js";
import { getAppSchema } from "../../app.js";

/**
 * Load env vars from the project's .env file.
 * Falls back to process.env for values not in .env.
 */
export function loadEnv(): Record<string, string> {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf-8");
  return dotenv.parse(content);
}

function getDatabaseUrl(): string {
  const env = loadEnv();
  const databaseUrl = env.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL not found in .env file. " +
      "Run setup_app_schema to configure the database.",
    );
  }
  return databaseUrl;
}

/** Lazy singleton pool shared across MCP tool calls. */
let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: getDatabaseUrl(), max: 3 });
  }
  return _pool;
}

/**
 * Get the Dev UI credentials page URL.
 * Uses CRAYON_DEV_URL (set by dev-server) or FLY_APP_NAME (cloud).
 * When integration/workflow/node are provided, returns a deep-link that
 * auto-opens the connect flow for that integration and assigns on success.
 */
export function getCredentialsPageUrl(
  integrationId?: string,
  workflowName?: string,
  nodeName?: string,
): string | undefined {
  let base = process.env.CRAYON_DEV_URL;
  if (!base) {
    const flyAppName = process.env.FLY_APP_NAME;
    if (!flyAppName) return undefined;
    base = `https://${flyAppName}.fly.dev/dev/`;
  }

  if (integrationId) {
    const parts = [integrationId, workflowName, nodeName]
      .filter((s): s is string => !!s)
      .map(encodeURIComponent);
    return `${base}#/credentials/${parts.join("/")}`;
  }
  return `${base}#/credentials`;
}

/**
 * Create an IntegrationProvider from env config.
 */
export async function createProvider() {
  const env = loadEnv();
  const nangoSecretKey = env.NANGO_SECRET_KEY ?? process.env.NANGO_SECRET_KEY ?? undefined;
  return createIntegrationProvider(nangoSecretKey);
}

/**
 * Resolve credentials for an integration connection.
 * Looks up the connection ID from the DB, then fetches credentials from the provider.
 */
export async function resolveCredentials(
  integrationId: string,
  workflowName: string,
  nodeName: string,
): Promise<{ connectionId: string; credentials: ConnectionCredentials }> {
  const appSchema = getAppSchema();
  const pool = getPool();

  const connectionId = await resolveConnectionId(
    pool, workflowName, nodeName, integrationId, appSchema,
  );

  if (!connectionId) {
    const credentialsUrl = getCredentialsPageUrl(integrationId, workflowName, nodeName);
    const urlHint = credentialsUrl
      ? ` Add a connection at: ${credentialsUrl}`
      : " Add a connection via the Dev UI Credentials page.";
    throw new Error(
      `No connection assigned for integration "${integrationId}" ` +
      `(workflow: "${workflowName}", node: "${nodeName}"). ` +
      `Use list_connections to check for existing connections, ` +
      `then assign_connection to assign one, then get_connection to verify.${urlHint}`,
    );
  }

  const provider = await createProvider();
  const credentials = await provider.fetchCredentials(integrationId, connectionId);

  return { connectionId, credentials };
}

/**
 * Assign a connection to a workflow/node.
 */
export async function assignConnection(
  integrationId: string,
  connectionId: string,
  workflowName: string,
  nodeName: string,
): Promise<void> {
  const appSchema = getAppSchema();
  const pool = getPool();
  await upsertConnection(
    pool,
    { workflow_name: workflowName, node_name: nodeName, integration_id: integrationId, connection_id: connectionId },
    appSchema,
  );
}
