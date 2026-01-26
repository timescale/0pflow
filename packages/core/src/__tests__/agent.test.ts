// packages/core/src/__tests__/agent.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { Agent } from "../agent.js";

describe("Agent.create()", () => {
  it("creates an executable with correct properties", () => {
    const inputSchema = z.object({ query: z.string() });

    const agent = Agent.create({
      name: "researcher",
      inputSchema,
      specPath: "specs/agents/researcher.md",
    });

    expect(agent.name).toBe("researcher");
    expect(agent.type).toBe("agent");
    expect(agent.inputSchema).toBe(inputSchema);
  });

  it("execute throws not implemented error", async () => {
    const agent = Agent.create({
      name: "researcher",
      inputSchema: z.object({ query: z.string() }),
      specPath: "specs/agents/researcher.md",
    });

    const mockCtx = { run: async () => {}, log: () => {} } as any;
    await expect(agent.execute(mockCtx, { query: "test" })).rejects.toThrow(
      "Agent execution not implemented (Phase 3)"
    );
  });
});
