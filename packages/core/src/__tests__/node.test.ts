// packages/core/src/__tests__/node.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { Node } from "../node.js";

describe("Node.create()", () => {
  it("creates an executable with correct properties", () => {
    const inputSchema = z.object({ value: z.number() });
    const outputSchema = z.object({ doubled: z.number() });

    const doubleNode = Node.create({
      name: "double",
      inputSchema,
      outputSchema,
      execute: async (_ctx, inputs) => ({ doubled: inputs.value * 2 }),
    });

    expect(doubleNode.name).toBe("double");
    expect(doubleNode.type).toBe("node");
    expect(doubleNode.inputSchema).toBe(inputSchema);
    expect(doubleNode.outputSchema).toBe(outputSchema);
  });

  it("infers input types from schema", async () => {
    const node = Node.create({
      name: "greet",
      inputSchema: z.object({ name: z.string() }),
      execute: async (_ctx, inputs) => `Hello, ${inputs.name}!`,
    });

    // Type check: inputs.name should be string
    const mockCtx = { run: async () => {}, log: () => {} } as any;
    const result = await node.execute(mockCtx, { name: "World" });
    expect(result).toBe("Hello, World!");
  });
});
