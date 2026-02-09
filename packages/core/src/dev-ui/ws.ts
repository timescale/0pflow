import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { ProjectDAGs, WorkflowDAG } from "./dag/types.js";

export type WSMessage =
  | { type: "full-sync"; data: ProjectDAGs }
  | { type: "workflow-updated"; data: WorkflowDAG }
  | { type: "workflow-removed"; data: { filePath: string } }
  | { type: "parse-error"; data: { filePath: string; error: string } };

export function createWSServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer });

  function broadcast(message: WSMessage) {
    const data = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  function sendTo(client: WebSocket, message: WSMessage) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  return { wss, broadcast, sendTo };
}
