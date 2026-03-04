import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const inputSchema = {
  path: z.string().describe("Absolute path to the directory to list"),
} as const;

const outputSchema = {
  entries: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["file", "directory", "symlink", "other"]),
        size: z.number().optional(),
      }),
    )
    .describe("Directory entries"),
} as const;

type Entry = {
  name: string;
  type: "file" | "directory" | "symlink" | "other";
  size?: number;
};

type OutputSchema = {
  entries: Entry[];
};

export const listDirectoryFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "list_directory",
    config: {
      title: "List Directory",
      description:
        "List contents of a directory on the sandbox filesystem. Returns name, type, and size for each entry.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ path }): Promise<OutputSchema> => {
      const dirents = await readdir(path, { withFileTypes: true });
      const entries: Entry[] = [];

      for (const d of dirents) {
        let type: Entry["type"] = "other";
        if (d.isFile()) type = "file";
        else if (d.isDirectory()) type = "directory";
        else if (d.isSymbolicLink()) type = "symlink";

        let size: number | undefined;
        if (type === "file") {
          try {
            const s = await stat(join(path, d.name));
            size = s.size;
          } catch {
            // skip size on error
          }
        }

        entries.push({ name: d.name, type, size });
      }

      return { entries };
    },
  };
};
