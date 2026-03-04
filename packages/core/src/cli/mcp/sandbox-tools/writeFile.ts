import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const inputSchema = {
  path: z.string().describe("Absolute path to the file to write"),
  content: z.string().describe("Content to write to the file"),
} as const;

const outputSchema = {
  success: z.boolean().describe("Whether the file was written successfully"),
  message: z.string().describe("Status message"),
} as const;

type OutputSchema = {
  success: boolean;
  message: string;
};

export const writeFileFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "write_file",
    config: {
      title: "Write File",
      description:
        "Write content to a file on the sandbox filesystem. Creates parent directories if they don't exist. Overwrites the file if it already exists.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ path, content }): Promise<OutputSchema> => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf-8");
      return { success: true, message: `Wrote ${content.length} bytes to ${path}` };
    },
  };
};
