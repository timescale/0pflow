// packages/core/src/nodes/agent/parser.ts
import { readFile } from "fs/promises";
import matter from "gray-matter";
import { z } from "zod";

/**
 * Schema for agent spec frontmatter
 */
const AgentFrontmatterSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
  maxSteps: z.number().optional(),
});

/**
 * Parsed agent specification
 */
export interface AgentSpec {
  /** Agent name from frontmatter */
  name: string;
  /** System prompt (markdown body) */
  systemPrompt: string;
  /** Optional model override (e.g., "openai/gpt-4o", "anthropic/claude-3-opus") */
  model?: string;
  /** Optional max steps for agentic loop */
  maxSteps?: number;
}

/**
 * Parse an agent spec markdown file
 */
export async function parseAgentSpec(specPath: string): Promise<AgentSpec> {
  const content = await readFile(specPath, "utf-8");
  return parseAgentSpecContent(content, specPath);
}

/**
 * Parse agent spec from content string (for testing)
 */
export function parseAgentSpecContent(
  content: string,
  sourcePath = "unknown"
): AgentSpec {
  const { data, content: body } = matter(content);

  // Validate frontmatter
  const frontmatter = AgentFrontmatterSchema.safeParse(data);
  if (!frontmatter.success) {
    throw new Error(
      `Invalid agent spec frontmatter in ${sourcePath}: ${frontmatter.error.message}`
    );
  }

  // Extract system prompt from body (trim whitespace)
  const systemPrompt = body.trim();
  if (!systemPrompt) {
    throw new Error(`Agent spec ${sourcePath} has no system prompt (empty body)`);
  }

  return {
    name: frontmatter.data.name,
    systemPrompt,
    model: frontmatter.data.model,
    maxSteps: frontmatter.data.maxSteps,
  };
}
