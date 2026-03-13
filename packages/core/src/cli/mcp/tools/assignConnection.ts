import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";
import { assignConnection } from "../lib/resolve-credentials.js";

const inputSchema = {
  integration_id: z
    .string()
    .describe("The integration ID (e.g., 'salesforce', 'slack')"),
  connection_id: z
    .string()
    .describe("The connection ID to assign (from list_connections)"),
  workflow_name: z
    .string()
    .describe(
      "Workflow name to scope this connection to. Use '*' for a global default that applies to all workflows.",
    ),
  node_name: z
    .string()
    .describe(
      "Node name to scope this connection to. Use '*' for a global default that applies to all nodes.",
    ),
} as const;

const outputSchema = {
  success: z.boolean().describe("Whether the assignment was successful"),
  error: z.string().optional().describe("Error message if assignment failed"),
} as const;

type OutputSchema = {
  success: boolean;
  error?: string;
};

export const assignConnectionFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "assign_connection",
    config: {
      title: "Assign Connection",
      description:
        "Assign a connection to a specific workflow/node. " +
        "Maps a connection ID (from list_connections) to a workflow/node pair " +
        "so that the node can resolve credentials at runtime. " +
        "Use workflow_name='*' and node_name='*' for a global default. " +
        "IMPORTANT: Before calling this tool, you MUST ask the user to confirm which connection " +
        "should be assigned to which node. Never assign automatically without explicit user approval.",
      inputSchema,
      outputSchema,
    },
    fn: async ({
      integration_id,
      connection_id,
      workflow_name,
      node_name,
    }): Promise<OutputSchema> => {
      try {
        await assignConnection(integration_id, connection_id, workflow_name, node_name);
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
};
