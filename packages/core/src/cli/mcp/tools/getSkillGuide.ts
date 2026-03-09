import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";
import { viewSkillContent } from "../lib/skills.js";

const inputSchema = {
  skill_name: z
    .string()
    .describe(
      'The name of the skill to view (e.g., "create-workflow", "integrations"), ' +
        'or "." to list all available skills.',
    ),
  path: z
    .string()
    .describe(
      "Relative path within the skill directory. " +
        'Empty or "SKILL.md" reads the main guide. ' +
        '"." lists the directory contents. ' +
        'Use paths like "scripts/fetch-schema.ts" or "salesforce.md" to read specific files.',
    ),
} as const;

const outputSchema = {
  content: z.string().describe("File content or directory listing."),
} as const;

type OutputSchema = {
  content: string;
};

export const getSkillGuideFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "view_skill",
    config: {
      title: "View Skill",
      description:
        "Browse crayon skill guides with procedural instructions for workflow development. " +
        "Use skill_name=\".\" to list all skills. " +
        "Use path=\".\" to list a skill's directory and discover resources. " +
        "Use path=\"SKILL.md\" (or empty) to read the main guide. " +
        "Use paths like \"scripts/fetch-schema.ts\" or \"salesforce.md\" to read specific files. " +
        "References to '/crayon:<name>' in guides correspond to skill '<name>' in this tool.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ skill_name, path }): Promise<OutputSchema> => {
      try {
        const content = await viewSkillContent(skill_name, path);
        return { content };
      } catch (err) {
        return {
          content: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
};
