import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWSServer } from "./ws.js";
import { createWatcher } from "./watcher.js";
import { handleApiRequest } from "./api.js";
import { ensureConnectionsTable } from "../connections/index.js";
import pg from "pg";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface DevServerOptions {
  projectRoot: string;
  port?: number;
  host?: boolean;
  databaseUrl?: string;
  nangoSecretKey?: string;
}

export async function startDevServer(options: DevServerOptions) {
  const { projectRoot, port = 4173, host = false } = options;

  // Pre-built client lives at dist/dev-ui-client/ relative to this file's dist location
  const __dir = dirname(fileURLToPath(import.meta.url));
  const clientDir = resolve(__dir, "../dev-ui-client");

  // Set up API context if database and Nango are configured
  const hasApi = !!(options.databaseUrl && options.nangoSecretKey);
  let pool: pg.Pool | null = null;

  if (hasApi) {
    await ensureConnectionsTable(options.databaseUrl!);
    pool = new pg.Pool({ connectionString: options.databaseUrl! });
  }

  const httpServer = createHttpServer(async (req, res) => {
    // Skip WebSocket upgrade requests
    if (req.headers.upgrade) return;

    const url = (req.url ?? "/").split("?")[0];

    // Route /api/* to API handler
    if (url.startsWith("/api/") && hasApi && pool) {
      try {
        const handled = await handleApiRequest(req, res, {
          pool,
          nangoSecretKey: options.nangoSecretKey!,
        });
        if (handled) return;
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }));
        return;
      }
    }

    const filePath = url === "/" ? "index.html" : url.slice(1);
    const absPath = resolve(clientDir, filePath);

    try {
      const body = await readFile(absPath);
      const ext = extname(absPath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(body);
    } catch {
      // SPA fallback — serve index.html for unmatched routes
      try {
        const indexBody = await readFile(resolve(clientDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(indexBody);
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Dev UI client not built. Run: pnpm --filter 0pflow build");
      }
    }
  });

  const { broadcast, sendTo, wss } = createWSServer(httpServer);

  // Create file watcher that broadcasts changes
  const watcher = createWatcher({
    projectRoot,
    onMessage: (msg) => broadcast(msg),
  });

  // On new WS connection, wait for initial scan then send full state
  wss.on("connection", async (ws) => {
    await watcher.waitForReady();
    sendTo(ws, { type: "full-sync", data: watcher.getState() });
  });

  const hostname = host ? "0.0.0.0" : "localhost";

  await new Promise<void>((resolvePromise) => {
    httpServer.listen(port, hostname, () => {
      resolvePromise();
    });
  });

  console.log(`\n  0pflow Dev UI running at:`);
  console.log(`  → http://localhost:${port}\n`);
  console.log(`  Watching for workflow changes in:`);
  console.log(`    ${resolve(projectRoot, "generated/workflows/")}`);
  console.log(`    ${resolve(projectRoot, "src/workflows/")}\n`);
  if (hasApi) {
    console.log(`  Connections API enabled (Nango + DB configured)\n`);
  } else {
    console.log(`  Connections API disabled (set DATABASE_URL and NANGO_SECRET_KEY to enable)\n`);
  }

  const cleanup = async () => {
    if (pool) {
      await pool.end();
    }
    await watcher.close();
    httpServer.close();
  };

  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });

  return { cleanup };
}
