import type { ApiFactory } from "@tigerdata/mcp-boilerplate";
import { z } from "zod";
import type { ServerContext } from "../types.js";
import { listSkillGuides, getSkillGuideContent } from "../lib/skills.js";

const inputSchema = {
  name: z
    .string()
    .optional()
    .describe(
      "Guide or skill resource name (e.g., 'create-workflow', 'integrations/salesforce', " +
        "'integrations/scripts/fetch-schema'). Omit to list all available guides and resources.",
    ),
} as const;

const outputSchema = {
  guides: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional()
    .describe("List of available guides (returned when name is omitted)"),
  content: z
    .string()
    .optional()
    .describe("Full guide content (returned when name is provided)"),
  error: z.string().optional().describe("Error message if guide not found"),
} as const;

type OutputSchema = {
  guides?: { name: string; description: string }[];
  content?: string;
  error?: string;
};

export const getSkillGuideFactory: ApiFactory<
  ServerContext,
  typeof inputSchema,
  typeof outputSchema
> = () => {
  return {
    name: "get_skill_guide",
    config: {
      title: "Get Skill Guide",
      description:
        "Get crayon skill guides with detailed procedural instructions for workflow development. " +
        "Call without a name to list available guides, or with a name to get the full content. " +
        "Guides include markdown instructions AND skill resources (e.g., " +
        "'integrations/scripts/fetch-schema', 'integrations/scripts/codegen'). " +
        "When a guide tells you to fetch a skill resource by name, use this tool with that name. " +
        "References to '/crayon:<name>' in guides map to guide '<name>' in this tool (e.g., '/crayon:refine-node' → get_skill_guide('refine-node')). " +
        "Available guides: create-workflow, compile-workflow, refine-node, integrations, " +
        "integrations/salesforce, integrations/postgres, integrations/unlisted.",
      inputSchema,
      outputSchema,
    },
    fn: async ({ name }): Promise<OutputSchema> => {
      try {
        if (!name) {
          const guides = await listSkillGuides();
          if (guides.length === 0) {
            return { error: "No skill guides found. The skills directory may not be bundled." };
          }
          return { guides };
        }

        const guide = await getSkillGuideContent(name);
        if (!guide) {
          const guides = await listSkillGuides();
          return {
            error: `Guide "${name}" not found. Available guides: ${guides.map((g) => g.name).join(", ")}`,
            guides,
          };
        }

        return { content: guide.content };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
};
