import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";
import pg from "pg";
import { createIntegrationProvider } from "../../../connections/integration-provider.js";
import { resolveConnectionId } from "../../../connections/resolver.js";
import type { ConnectionCredentials } from "../../../types.js";
import { getAppSchema } from "../../app.js";

/**
 * Load env vars from the project's .env file.
 * Falls back to process.env for values not in .env.
 */
function loadEnv(): Record<string, string> {
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

/**
 * Resolve credentials for an integration connection.
 * Looks up the connection ID from the DB, then fetches credentials from the provider.
 */
export async function resolveCredentials(
  integrationId: string,
  workflowName: string,
  nodeName: string,
): Promise<{ connectionId: string; credentials: ConnectionCredentials }> {
  const databaseUrl = getDatabaseUrl();
  const appSchema = getAppSchema();
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

  try {
    const connectionId = await resolveConnectionId(
      pool, workflowName, nodeName, integrationId, appSchema,
    );

    if (!connectionId) {
      throw new Error(
        `No connection configured for integration "${integrationId}" ` +
        `(workflow: "${workflowName}", node: "${nodeName}"). ` +
        `Use the Dev UI Credentials page to connect an account first.`,
      );
    }

    const env = loadEnv();
    const nangoSecretKey = env.NANGO_SECRET_KEY ?? process.env.NANGO_SECRET_KEY ?? undefined;
    const provider = await createIntegrationProvider(nangoSecretKey);
    const credentials = await provider.fetchCredentials(integrationId, connectionId);

    return { connectionId, credentials };
  } finally {
    await pool.end();
  }
}
