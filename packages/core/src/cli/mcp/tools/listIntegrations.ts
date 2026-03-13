import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";
import { getProvider } from "../../../connections/manager.js";

const inputSchema = {} as const;

const outputSchema = {
  integrations: z.array(
    z.object({
      id: z.string().describe("Integration unique key (use this in node integrations arrays)"),
      provider: z.string().describe("Provider name (e.g., salesforce, slack)"),
    }),
  ).describe("Available integrations"),
  error: z.string().optional().describe("Error message if listing failed"),
} as const;

type OutputSchema = {
  integrations: Array<{ id: string; provider: string }>;
  error?: string;
};

export const listIntegrationsFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "list_integrations",
    config: {
      title: "List Integrations",
      description:
        "List available integrations. Uses NANGO_SECRET_KEY for local mode, or crayon cloud (auto-authenticates via browser if needed).",
      inputSchema,
      outputSchema,
    },
    fn: async (): Promise<OutputSchema> => {
      try {
        const integrations = await getProvider().listIntegrations();
        return { integrations };
      } catch (err) {
        return {
          integrations: [],
          error: `Failed to list integrations: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
};
