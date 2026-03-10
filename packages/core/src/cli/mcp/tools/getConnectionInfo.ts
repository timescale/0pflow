import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";
import { resolveCredentials } from "../lib/resolve-credentials.js";

const inputSchema = {
  integration_id: z
    .string()
    .describe(
      "The integration ID to look up (e.g., 'salesforce', 'slack'). " +
      "Must match an integration_id in the crayon_connections table.",
    ),
  workflow_name: z
    .string()
    .describe("Workflow name for connection lookup. Used to resolve workflow/node-scoped connections, with fallback to global default."),
  node_name: z
    .string()
    .describe("Node name for connection lookup. Used to resolve workflow/node-scoped connections, with fallback to global default."),
} as const;

const outputSchema = {
  connection_id: z.string().optional().describe("The Nango connection ID"),
  provider: z.string().optional().describe("Provider name (e.g., salesforce)"),
  connection_config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Provider-specific config (e.g., instance_url for Salesforce)"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Custom metadata stored on the connection"),
  access_token: z
    .string()
    .optional()
    .describe("OAuth access token for the connection (for dev-time operations like schema fetching)"),
  error: z.string().optional().describe("Error message if lookup failed"),
} as const;

type OutputSchema = {
  connection_id?: string;
  provider?: string;
  connection_config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  access_token?: string;
  error?: string;
};

export const getConnectionInfoFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "get_connection_info",
    config: {
      title: "Get Connection Info",
      description:
        "Get metadata for a configured integration connection. " +
        "Resolves the connection ID from the crayon_connections table, " +
        "then fetches connection details via IntegrationProvider (local Nango or cloud).",
      inputSchema,
      outputSchema,
    },
    fn: async ({ integration_id, workflow_name, node_name }): Promise<OutputSchema> => {
      try {
        const { connectionId, credentials } = await resolveCredentials(
          integration_id, workflow_name, node_name,
        );

        return {
          connection_id: connectionId,
          provider: integration_id,
          connection_config: credentials.connectionConfig ?? {},
          access_token: credentials.token,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
};
