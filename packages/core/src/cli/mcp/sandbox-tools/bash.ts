import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { execFile } from "node:child_process";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const DEFAULT_TIMEOUT = 120_000;
const DEFAULT_CWD = "/data/app";

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
        "Execute a shell command on the sandbox. Returns stdout, stderr, and exit code.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ command, timeout, cwd }): Promise<OutputSchema> => {
      return new Promise((resolve) => {
        execFile(
          "bash",
          ["-c", command],
          {
            timeout,
            cwd,
            maxBuffer: 10 * 1024 * 1024,
            env: process.env,
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
