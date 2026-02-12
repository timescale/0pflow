import type { IntegrationProvider } from "./integration-provider.js";
import type { ConnectionCredentials } from "../types.js";
import { apiCall } from "./cloud-client.js";

/**
 * IntegrationProvider backed by the 0pflow cloud server (hosted mode).
 * All Nango operations are proxied through the server — no NANGO_SECRET_KEY needed locally.
 */
export class CloudIntegrationProvider implements IntegrationProvider {
  async fetchCredentials(
    integrationId: string,
    connectionId: string,
  ): Promise<ConnectionCredentials> {
    const data = (await apiCall(
      "GET",
      `/api/credentials/${encodeURIComponent(integrationId)}?connection_id=${encodeURIComponent(connectionId)}`,
    )) as ConnectionCredentials;

    return data;
  }

  async listIntegrations(): Promise<Array<{ id: string; provider: string }>> {
    const data = (await apiCall("GET", "/api/integrations")) as Array<{
      id: string;
      provider: string;
    }>;
    return data;
  }

  async listConnections(
    integrationId: string,
  ): Promise<Array<{ connection_id: string; provider_config_key: string }>> {
    const data = (await apiCall(
      "GET",
      `/api/integrations/${encodeURIComponent(integrationId)}/connections`,
    )) as Array<{ connection_id: string; provider_config_key: string }>;
    return data;
  }

  async createConnectSession(
    integrationId: string,
  ): Promise<{ token: string }> {
    const data = (await apiCall("POST", "/api/nango/connect-session", {
      integration_id: integrationId,
    })) as { token: string };
    return data;
  }
}
