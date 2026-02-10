import type { IncomingMessage, ServerResponse } from "node:http";
import type pg from "pg";
import {
  listConnections,
  upsertConnection,
  deleteConnection,
} from "../connections/index.js";

export interface ApiContext {
  pool: pg.Pool;
  nangoSecretKey: string;
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Handle API requests. Returns true if the request was handled, false otherwise.
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ApiContext,
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS" && url.startsWith("/api/")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, DELETE, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }

  // GET /api/connections
  if (url === "/api/connections" && method === "GET") {
    const connections = await listConnections(ctx.pool);
    jsonResponse(res, 200, connections);
    return true;
  }

  // PUT /api/connections
  if (url === "/api/connections" && method === "PUT") {
    const body = (await parseBody(req)) as {
      workflow_name?: string;
      node_name?: string;
      integration_id?: string;
      connection_id?: string;
    };
    if (!body.integration_id || !body.connection_id) {
      jsonResponse(res, 400, { error: "integration_id and connection_id are required" });
      return true;
    }
    await upsertConnection(ctx.pool, {
      workflow_name: body.workflow_name ?? "*",
      node_name: body.node_name ?? "*",
      integration_id: body.integration_id,
      connection_id: body.connection_id,
    });
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  // DELETE /api/connections
  if (url === "/api/connections" && method === "DELETE") {
    const body = (await parseBody(req)) as {
      workflow_name?: string;
      node_name?: string;
      integration_id?: string;
    };
    if (!body.integration_id) {
      jsonResponse(res, 400, { error: "integration_id is required" });
      return true;
    }
    await deleteConnection(
      ctx.pool,
      body.workflow_name ?? "*",
      body.node_name ?? "*",
      body.integration_id,
    );
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  // GET /api/nango/integrations — list available integrations from Nango
  if (url === "/api/nango/integrations" && method === "GET") {
    try {
      const { Nango } = await import("@nangohq/node");
      const nango = new Nango({ secretKey: ctx.nangoSecretKey });
      const result = await nango.listIntegrations();
      const integrations = (result.configs ?? []).map(
        (c: { unique_key: string; provider: string }) => ({
          id: c.unique_key,
          provider: c.provider,
        }),
      );
      jsonResponse(res, 200, integrations);
    } catch (err) {
      jsonResponse(res, 500, {
        error: err instanceof Error ? err.message : "Failed to list Nango integrations",
      });
    }
    return true;
  }

  // GET /api/nango/connections/:integrationId
  const nangoConnectionsMatch = url.match(/^\/api\/nango\/connections\/([^/]+)$/);
  if (nangoConnectionsMatch && method === "GET") {
    const integrationId = decodeURIComponent(nangoConnectionsMatch[1]);
    try {
      const { Nango } = await import("@nangohq/node");
      const nango = new Nango({ secretKey: ctx.nangoSecretKey });
      const result = await nango.listConnections();
      const filtered = (result.connections ?? []).filter(
        (c: { provider_config_key: string }) => c.provider_config_key === integrationId,
      );
      jsonResponse(res, 200, filtered);
    } catch (err) {
      jsonResponse(res, 500, {
        error: err instanceof Error ? err.message : "Failed to list Nango connections",
      });
    }
    return true;
  }

  // POST /api/nango/connect-session
  if (url === "/api/nango/connect-session" && method === "POST") {
    const body = (await parseBody(req)) as {
      integration_id?: string;
      connection_id?: string;
    };
    if (!body.integration_id) {
      jsonResponse(res, 400, { error: "integration_id is required" });
      return true;
    }
    try {
      const { Nango } = await import("@nangohq/node");
      const nango = new Nango({ secretKey: ctx.nangoSecretKey });
      const session = await nango.createConnectSession({
        end_user: { id: "dev-ui-user" },
        allowed_integrations: [body.integration_id],
      });
      jsonResponse(res, 200, { token: session.data.token });
    } catch (err) {
      jsonResponse(res, 500, {
        error: err instanceof Error ? err.message : "Failed to create connect session",
      });
    }
    return true;
  }

  return false;
}
