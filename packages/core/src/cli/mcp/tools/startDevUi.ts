import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const inputSchema = {
  port: z
    .number()
    .optional()
    .describe(
      "Preferred port (default 4173). Falls back to an available port if taken.",
    ),
} as const;

const outputSchema = {
  url: z.string().optional().describe("Dev UI URL (e.g. http://localhost:4173)"),
  port: z.number().optional().describe("Actual port the server is running on"),
  already_running: z
    .boolean()
    .optional()
    .describe("True if the server was already running from a previous call"),
  error: z.string().optional().describe("Error message if the server could not start"),
} as const;

type OutputSchema = {
  url?: string;
  port?: number;
  already_running?: boolean;
  error?: string;
};

// Module-level singleton state
let devServer: {
  url: string;
  port: number;
  cleanup: () => Promise<void>;
} | null = null;

export const startDevUiFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "start_dev_ui",
    config: {
      title: "Start Dev UI",
      description:
        "Start the 0pflow Dev UI server for visualizing workflow DAGs. " +
        "Returns the URL with the actual port. Idempotent — if already running, returns existing URL. " +
        "Automatically picks an available port if the default (4173) is taken.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ port }): Promise<OutputSchema> => {
      // Singleton: if already running, return existing info
      if (devServer) {
        return {
          url: devServer.url,
          port: devServer.port,
          already_running: true,
        };
      }

      // Check that the dev-ui client has been built (find package root first)
      let pkgRoot = dirname(fileURLToPath(import.meta.url));
      while (!existsSync(resolve(pkgRoot, "package.json"))) {
        const parent = dirname(pkgRoot);
        if (parent === pkgRoot) break;
        pkgRoot = parent;
      }
      const clientIndex = resolve(pkgRoot, "dist/dev-ui-client/index.html");
      if (!existsSync(clientIndex)) {
        return {
          error:
            "Dev UI client not built. Run: pnpm --filter 0pflow build",
        };
      }

      // Load .env for DATABASE_URL and NANGO_SECRET_KEY (best-effort)
      try {
        const { resolveEnv } = await import("../../env.js");
        resolveEnv();
      } catch {
        // Dev UI works without env — connections API just won't be available
      }

      const { startDevServer } = await import("../../../dev-ui/index.js");

      const result = await startDevServer({
        projectRoot: process.cwd(),
        port: port ?? 4173,
        quiet: true, // Critical: suppress stdout in MCP stdio transport
        databaseUrl: process.env.DATABASE_URL,
        nangoSecretKey: process.env.NANGO_SECRET_KEY,
      });

      devServer = {
        url: result.url,
        port: result.port,
        cleanup: result.cleanup,
      };

      // Safety net: clean up if stdin closes (Claude Code exited)
      process.stdin.on("end", () => {
        if (devServer) {
          devServer.cleanup().catch(() => {});
          devServer = null;
        }
      });

      return {
        url: result.url,
        port: result.port,
        already_running: false,
      };
    },
  };
};
