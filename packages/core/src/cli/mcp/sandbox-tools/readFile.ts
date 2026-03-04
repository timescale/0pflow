import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const inputSchema = {
  path: z.string().describe("Absolute path to the file to read"),
  offset: z
    .number()
    .optional()
    .describe("Line number to start reading from (1-based)"),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of lines to return"),
} as const;

const outputSchema = {
  content: z.string().describe("File content"),
  total_lines: z.number().describe("Total number of lines in the file"),
} as const;

type OutputSchema = {
  content: string;
  total_lines: number;
};

export const readFileFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "read_file",
    config: {
      title: "Read File",
      description:
        "Read file contents from the sandbox filesystem. Supports optional line offset and limit for large files.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ path, offset, limit }): Promise<OutputSchema> => {
      const raw = await readFile(path, "utf-8");
      const allLines = raw.split("\n");
      const totalLines = allLines.length;

      if (offset || limit) {
        const start = (offset ?? 1) - 1;
        const end = limit ? start + limit : undefined;
        const sliced = allLines.slice(start, end);
        return { content: sliced.join("\n"), total_lines: totalLines };
      }

      return { content: raw, total_lines: totalLines };
    },
  };
};
