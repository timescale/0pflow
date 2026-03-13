import pg from "pg";
import {
  resolveConnectionId as _resolveConnectionId,
  upsertConnection as _upsertConnection,
  listConnections as _listConnections,
  deleteConnection as _deleteConnection,
  deleteConnectionByConnectionId as _deleteConnectionByConnectionId,
} from "./resolver.js";
import type { ConnectionMapping } from "./resolver.js";
import type { IntegrationProvider } from "./integration-provider.js";
import type { ConnectionCredentials } from "../types.js";

// ── Configuration ───────────────────────────────────────────────────

let _pool: pg.Pool | null = null;
let _schema: string | null = null;
let _provider: IntegrationProvider | null = null;

/**
 * Configure the shared pool, schema, and integration provider used by all manager functions.
 * Called once during startup (dev-server or MCP init).
 */
export function configureConnectionManager(pool: pg.Pool, schema: string, provider: IntegrationProvider): void {
  _pool = pool;
  _schema = schema;
  _provider = provider;
}

function requirePool(): pg.Pool {
  if (!_pool) throw new Error("Connection manager not configured. Call configureConnectionManager() first.");
  return _pool;
}

function requireSchema(): string {
  if (!_schema) throw new Error("Connection manager not configured. Call configureConnectionManager() first.");
  return _schema;
}

function requireProvider(): IntegrationProvider {
  if (!_provider) throw new Error("Connection manager not configured. Call configureConnectionManager() first.");
  return _provider;
}

// ── Change notifications ────────────────────────────────────────────

const _connectionChangeListeners = new Set<() => void>();

export function onConnectionChange(listener: () => void): () => void {
  _connectionChangeListeners.add(listener);
  return () => _connectionChangeListeners.delete(listener);
}

function notifyConnectionChange() {
  for (const listener of _connectionChangeListeners) {
    listener();
  }
}

// ── Operations ──────────────────────────────────────────────────────

export async function resolveConnectionId(
  workflowName: string,
  nodeName: string,
  integrationId: string,
): Promise<string | null> {
  return _resolveConnectionId(requirePool(), workflowName, nodeName, integrationId, requireSchema());
}

export async function assignConnection(
  integrationId: string,
  connectionId: string,
  workflowName: string,
  nodeName: string,
): Promise<void> {
  await _upsertConnection(
    requirePool(),
    { workflow_name: workflowName, node_name: nodeName, integration_id: integrationId, connection_id: connectionId },
    requireSchema(),
  );
  notifyConnectionChange();
}

export async function listConnectionMappings(): Promise<ConnectionMapping[]> {
  return _listConnections(requirePool(), requireSchema());
}

export async function unassignConnection(
  workflowName: string,
  nodeName: string,
  integrationId: string,
): Promise<void> {
  await _deleteConnection(requirePool(), workflowName, nodeName, integrationId, requireSchema());
  notifyConnectionChange();
}

export async function unassignConnectionById(
  integrationId: string,
  connectionId: string,
): Promise<void> {
  await _deleteConnectionByConnectionId(requirePool(), integrationId, connectionId, requireSchema());
  notifyConnectionChange();
}

export function getProvider(): IntegrationProvider {
  return requireProvider();
}

/**
 * Get the Dev UI URL for adding a new connection (deep-links to a specific integration if provided).
 */
export function getAddConnectionUrl(
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

export async function resolveCredentials(
  integrationId: string,
  workflowName: string,
  nodeName: string,
): Promise<{ connectionId: string; credentials: ConnectionCredentials }> {
  const connectionId = await resolveConnectionId(workflowName, nodeName, integrationId);
  if (!connectionId) {
    throw new Error(
      `No connection assigned for integration "${integrationId}" ` +
      `(workflow: "${workflowName}", node: "${nodeName}").`,
    );
  }
  const credentials = await requireProvider().fetchCredentials(integrationId, connectionId);
  return { connectionId, credentials };
}
