import { stdioServerFactory } from "@tigerdata/mcp-boilerplate";
import { version } from "./config.js";
import type { ServerContext } from "./types.js";
import { getSandboxApiFactories } from "./sandbox-tools/index.js";

const serverInfo = {
  name: "crayon-sandbox-tools",
  version,
} as const;

const context: ServerContext = {};

function buildInstructions(): string {
  const lines = [
    "You are connected to a remote cloud sandbox via MCP.",
    "All file and bash operations run via this MCP run on the sandbox.",
    "The project root is /data/app.",
  ];

  const flyAppName = process.env.FLY_APP_NAME;
  if (flyAppName) {
    const publicUrl = `https://${flyAppName}.fly.dev`;
    lines.push(
      `The sandbox's public URL is: ${publicUrl}`,
      `The dev UI is at: ${publicUrl}/dev/`,
      "When the app's dev server is running, it is accessible at this public URL you can tell the user to look at it.",
    );
  }

  return lines.join("\n");
}

/**
 * Start the sandbox MCP server in stdio mode.
 * Exposes filesystem and bash tools for remote sandbox access.
 */
export async function startSandboxMcpServer(): Promise<void> {
  const apiFactories = await getSandboxApiFactories();

  await stdioServerFactory({
    ...serverInfo,
    context,
    apiFactories,
    instructions: buildInstructions(),
  });
}
