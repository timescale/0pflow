import type { IntegrationProvider } from "./integration-provider.js";
import type { ConnectionCredentials } from "../types.js";

/**
 * IntegrationProvider backed by a direct Nango connection (self-hosted mode).
 * Requires NANGO_SECRET_KEY.
 */
export class LocalIntegrationProvider implements IntegrationProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nango: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(nangoInstance: any) {
    this.nango = nangoInstance;
  }

  async fetchCredentials(
    integrationId: string,
    connectionId: string,
  ): Promise<ConnectionCredentials> {
    const connection = await this.nango.getConnection(integrationId, connectionId);

    const creds = connection.credentials ?? {};
    const token =
      creds.access_token ??
      creds.api_key ??
      creds.apiKey ??
      creds.token ??
      "";

    return {
      token,
      connectionConfig: connection.connection_config ?? {},
      raw: creds,
    };
  }

  async listIntegrations(): Promise<Array<{ id: string; provider: string }>> {
    const result = await this.nango.listIntegrations();
    return (result.configs ?? []).map(
      (c: { unique_key: string; provider: string }) => ({
        id: c.unique_key,
        provider: c.provider,
      }),
    );
  }

  async listConnections(
    integrationId: string,
  ): Promise<Array<{ connection_id: string; provider_config_key: string }>> {
    const result = await this.nango.listConnections();
    return (result.connections ?? []).filter(
      (c: { provider_config_key: string }) =>
        c.provider_config_key === integrationId,
    );
  }

  async createConnectSession(
    integrationId: string,
    endUserId?: string,
  ): Promise<{ token: string }> {
    const session = await this.nango.createConnectSession({
      end_user: { id: endUserId ?? "dev-ui-user" },
      allowed_integrations: [integrationId],
    });
    return { token: session.data.token };
  }
}

/**
 * Create a LocalIntegrationProvider from a Nango secret key.
 * Uses dynamic import to avoid hard dependency on @nangohq/node.
 */
export async function createLocalIntegrationProvider(
  secretKey: string,
): Promise<LocalIntegrationProvider> {
  const { Nango } = await import("@nangohq/node");
  const nango = new Nango({ secretKey });
  return new LocalIntegrationProvider(nango);
}
