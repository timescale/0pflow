import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import * as dotenv from "dotenv";
import type { ServerContext } from "../types.js";

const inputSchema = {} as const;

const outputSchema = {
  integrations: z.array(
    z.object({
      id: z.string().describe("Integration unique key (use this in node integrations arrays)"),
      provider: z.string().describe("Provider name (e.g., salesforce, slack)"),
    }),
  ).describe("Available Nango integrations"),
  error: z.string().optional().describe("Error message if listing failed"),
} as const;

type OutputSchema = {
  integrations: Array<{ id: string; provider: string }>;
  error?: string;
};

/**
 * Find and load NANGO_SECRET_KEY from the project's .env file
 */
function loadNangoSecretKey(): string | null {
  // Walk up from cwd looking for .env
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return null;

  const content = readFileSync(envPath, "utf-8");
  const env = dotenv.parse(content);
  return env.NANGO_SECRET_KEY ?? null;
}

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
        "List available Nango integrations configured for this project. Reads NANGO_SECRET_KEY from the project's .env file and queries Nango for configured integrations.",
      inputSchema,
      outputSchema,
    },
    fn: async (): Promise<OutputSchema> => {
      const secretKey = loadNangoSecretKey();

      if (!secretKey) {
        return {
          integrations: [],
          error:
            "NANGO_SECRET_KEY not found in .env file. " +
            "Set up Nango (https://nango.dev) and add NANGO_SECRET_KEY to your .env file to use integrations.",
        };
      }

      try {
        const { Nango } = await import("@nangohq/node");
        const nango = new Nango({ secretKey });
        const result = await nango.listIntegrations();
        const integrations = (result.configs ?? []).map(
          (c: { unique_key: string; provider: string }) => ({
            id: c.unique_key,
            provider: c.provider,
          }),
        );
        return { integrations };
      } catch (err) {
        return {
          integrations: [],
          error: `Failed to list Nango integrations: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
};
