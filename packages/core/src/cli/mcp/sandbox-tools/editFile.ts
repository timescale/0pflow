import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { ServerContext } from "../types.js";

const inputSchema = {
  path: z.string().describe("Absolute path to the file to edit"),
  old_string: z.string().describe("The exact text to find and replace"),
  new_string: z.string().describe("The replacement text"),
  replace_all: z
    .boolean()
    .optional()
    .default(false)
    .describe("Replace all occurrences (default: false, requires unique match)"),
} as const;

const outputSchema = {
  success: z.boolean().describe("Whether the edit was applied"),
  message: z.string().describe("Status message"),
} as const;

type OutputSchema = {
  success: boolean;
  message: string;
};

export const editFileFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "edit_file",
    config: {
      title: "Edit File",
      description:
        "Perform exact string replacement in a file. By default, old_string must appear exactly once (for safety). Set replace_all to replace every occurrence.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ path, old_string, new_string, replace_all }): Promise<OutputSchema> => {
      const content = await readFile(path, "utf-8");

      if (!content.includes(old_string)) {
        return { success: false, message: `old_string not found in ${path}` };
      }

      if (!replace_all) {
        const first = content.indexOf(old_string);
        const second = content.indexOf(old_string, first + 1);
        if (second !== -1) {
          return {
            success: false,
            message: `old_string appears multiple times in ${path}. Use replace_all or provide more context to make it unique.`,
          };
        }
      }

      const updated = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);

      await writeFile(path, updated, "utf-8");
      return { success: true, message: `Applied edit to ${path}` };
    },
  };
};
