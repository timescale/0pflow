import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import { setupAppSchema } from "../lib/scaffolding.js";
import type { ServerContext } from "../types.js";

const inputSchema = {
  directory: z
    .string()
    .optional()
    .default(".")
    .describe("Directory of the application, relative to cwd (default: current working directory)"),
  service_id: z.string().describe("Tiger Cloud service ID for the database"),
  app_name: z
    .string()
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "App name must be lowercase alphanumeric with underscores, starting with a letter",
    )
    .describe(
      "Application name (used for schema and user name, must be lowercase with underscores)",
    ),
} as const;

const outputSchema = {
  success: z.boolean().describe("Whether app schema setup succeeded"),
  message: z.string().describe("Status message"),
  schema_name: z.string().optional().describe("Name of the created schema"),
  user_name: z.string().optional().describe("Name of the created user"),
} as const;

type OutputSchema = {
  success: boolean;
  message: string;
  schema_name?: string | undefined;
  user_name?: string | undefined;
};

export const setupAppSchemaFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "setup_app_schema",
    config: {
      title: "Setup App Schema",
      description:
        "Set up database schema and user for the application. Creates a PostgreSQL schema and user named after the app, with appropriate permissions, and writes DATABASE_URL to .env.",
      inputSchema,
      outputSchema,
    },
    fn: async ({
      directory,
      service_id,
      app_name,
    }): Promise<OutputSchema> => {
      return setupAppSchema({
        directory,
        serviceId: service_id,
        appName: app_name,
      });
    },
  };
};
