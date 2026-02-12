import type { ConnectionCredentials } from "../types.js";

/**
 * Abstraction over integration/credential operations.
 *
 * LocalIntegrationProvider calls Nango directly (self-hosted mode).
 * CloudIntegrationProvider calls the 0pflow cloud server (hosted mode).
 *
 * Connection *mapping* (workflow/node → connection_id) is NOT part of this
 * interface — that stays in the user's local app DB via resolver.ts.
 */
export interface IntegrationProvider {
  /** Fetch actual credentials for a Nango connection */
  fetchCredentials(
    integrationId: string,
    connectionId: string,
  ): Promise<ConnectionCredentials>;

  /** List available integrations from Nango */
  listIntegrations(): Promise<
    Array<{ id: string; provider: string }>
  >;

  /** List connections for an integration */
  listConnections(
    integrationId: string,
  ): Promise<Array<{ connection_id: string; provider_config_key: string }>>;

  /** Create a Nango Connect session for OAuth setup */
  createConnectSession(
    integrationId: string,
    endUserId?: string,
  ): Promise<{ token: string }>;
}
