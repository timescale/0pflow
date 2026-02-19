import type { IncomingMessage, ServerResponse } from "node:http";
import { deploy } from "../cli/deploy.js";

/**
 * Handle deploy SSE endpoint for the Dev UI.
 * POST /api/deploy — streams progress events via SSE.
 *
 * Returns true if the request was handled.
 */
export async function handleDeployRequest(
  req: IncomingMessage,
  res: ServerResponse,
  projectDir: string,
): Promise<boolean> {
  const url = (req.url ?? "").split("?")[0];
  const method = req.method ?? "GET";

  if (url !== "/api/deploy" || method !== "POST") return false;

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await deploy(projectDir, {
      onProgress: (progress) => {
        sendEvent({ type: "progress", ...progress });
      },
    });

    if (result.success) {
      sendEvent({ type: "done", url: result.url });
    } else {
      sendEvent({ type: "error", message: result.error });
    }
  } catch (err) {
    sendEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  res.end();
  return true;
}
