// agents/page-summarizer.ts
// Agent executable for page-summarizer
import { z } from "zod";
import { Agent } from "0pflow";

export const pageSummarizer = Agent.create({
  name: "page-summarizer",
  inputSchema: z.object({
    content: z.string().nullable(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  specPath: "../specs/agents/page-summarizer.md",
});
