import type { ConnectionCredentials } from "../types.js";

// Use dynamic import to avoid hard dependency when Nango isn't configured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nangoInstance: any = null;

/**
 * Initialize the Nango client singleton.
 */
export async function initNango(secretKey: string): Promise<void> {
  const { Nango } = await import("@nangohq/node");
  nangoInstance = new Nango({ secretKey });
}

/**
 * Get the Nango client instance, or null if not initialized.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNango(): any | null {
  return nangoInstance;
}

/**
 * Fetch credentials for an integration connection from Nango.
 */
export async function fetchCredentials(
  integrationId: string,
  connectionId: string,
): Promise<ConnectionCredentials> {
  if (!nangoInstance) {
    throw new Error(
      "Nango not initialized. Set NANGO_SECRET_KEY environment variable or nangoSecretKey in config.",
    );
  }

  const connection = await nangoInstance.getConnection(integrationId, connectionId);

  // Extract token from credentials based on auth type
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
