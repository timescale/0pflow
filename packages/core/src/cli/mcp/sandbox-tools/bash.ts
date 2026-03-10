import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { execFile } from "node:child_process";
import { z } from "zod";
import type { ConnectionCredentials } from "../../../types.js";
import { resolveCredentials } from "../lib/resolve-credentials.js";
import type { ServerContext } from "../types.js";

const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_CWD = "/data/app";

const credentialSchema = z.object({
  integration_id: z
    .string()
    .describe("Integration ID to fetch credentials for (e.g., 'postgres', 'salesforce')"),
  workflow_name: z
    .string()
    .describe("Workflow name for scoped connection lookup"),
  node_name: z
    .string()
    .describe("Node name for scoped connection lookup"),
  env_mapping: z
    .record(z.string(), z.string())
    .describe(
      "Map of ENV_VAR_NAME to dot-path into credentials " +
      "(e.g., { PGHOST: 'connectionConfig.host', PGPASSWORD: 'raw.password' })",
    ),
});

const inputSchema = {
  command: z.string().describe("Shell command to execute"),
  timeout: z
    .number()
    .optional()
    .default(DEFAULT_TIMEOUT)
    .describe("Timeout in milliseconds (default: 120000)"),
  cwd: z
    .string()
    .optional()
    .default(DEFAULT_CWD)
    .describe("Working directory (default: /data/app)"),
  credentials: z
    .array(credentialSchema)
    .optional()
    .describe(
      "Optional: resolve integration credentials and inject as environment variables. " +
      "Credentials are fetched server-side and never appear in the tool call.",
    ),
} as const;

const outputSchema = {
  stdout: z.string().describe("Standard output"),
  stderr: z.string().describe("Standard error"),
  exit_code: z.number().describe("Exit code (0 = success)"),
} as const;

type OutputSchema = {
  stdout: string;
  stderr: string;
  exit_code: number;
};

/**
 * Resolve a dot-path like "connectionConfig.host" against a ConnectionCredentials object.
 */
function resolveDotPath(obj: ConnectionCredentials, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (current == null) return undefined;
  return String(current);
}

export const bashFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "bash",
    config: {
      title: "Bash",
      description:
        "Execute a shell command on the sandbox. Returns stdout, stderr, and exit code. " +
        "Optionally resolves integration credentials and injects them as environment variables.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ command, timeout, cwd, credentials }): Promise<OutputSchema> => {
      const env: Record<string, string | undefined> = { ...process.env };

      if (credentials && credentials.length > 0) {
        try {
          for (const cred of credentials) {
            const { credentials: connCreds } = await resolveCredentials(
              cred.integration_id,
              cred.workflow_name,
              cred.node_name,
            );

            for (const [envVar, dotPath] of Object.entries(cred.env_mapping)) {
              const value = resolveDotPath(connCreds, dotPath);
              if (value === undefined) {
                return {
                  stdout: "",
                  stderr:
                    `Credential path "${dotPath}" resolved to undefined for env var ${envVar} ` +
                    `(integration: "${cred.integration_id}").`,
                  exit_code: 1,
                };
              }
              env[envVar] = value;
            }
          }
        } catch (err) {
          return {
            stdout: "",
            stderr: `Credential resolution failed: ${err instanceof Error ? err.message : String(err)}`,
            exit_code: 1,
          };
        }
      }

      return new Promise((resolve) => {
        execFile(
          "bash",
          ["-c", command],
          {
            timeout,
            cwd,
            maxBuffer: 10 * 1024 * 1024,
            env,
          },
          (error, stdout, stderr) => {
            const exit_code =
              error && "code" in error ? (error.code as number) ?? 1 : error ? 1 : 0;
            resolve({ stdout, stderr, exit_code });
          },
        );
      });
    },
  };
};
