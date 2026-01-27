// agents/page-summarizer.ts
// Agent executable for page-summarizer
import { z } from "zod";
import { Agent } from "0pflow";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pageSummarizer = Agent.create({
  name: "page-summarizer",
  inputSchema: z.object({
    content: z.string().nullable(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  specPath: path.resolve(__dirname, "../specs/agents/page-summarizer.md"),
});
