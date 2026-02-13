import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import { createDatabase } from "../lib/scaffolding.js";
import type { ServerContext } from "../types.js";

const inputSchema = {
  name: z.string().optional().describe("Database name (default: app-db)"),
} as const;

const outputSchema = {
  success: z
    .boolean()
    .describe("Whether the database was created successfully"),
  service_id: z.string().optional().describe("The Tiger Cloud service ID"),
  error: z.string().optional().describe("Error message if creation failed"),
} as const;

type OutputSchema = {
  success: boolean;
  service_id?: string;
  error?: string;
};

export const createDatabaseFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "create_database",
    config: {
      title: "Create Database",
      description:
        "Create a PostgreSQL database on Tiger Cloud (FREE tier). Auto-configures with TimescaleDB and AI extensions.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ name }): Promise<OutputSchema> => {
      return createDatabase({ name });
    },
  };
};
