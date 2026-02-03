// packages/core/src/__tests__/node-registry.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { NodeRegistry } from "../nodes/registry.js";
import { Node } from "../node.js";

describe("NodeRegistry", () => {
  const customNode = Node.create({
    name: "custom.echo",
    description: "Echo input",
    inputSchema: z.object({ msg: z.string() }),
    execute: async (_ctx, { msg }) => msg,
  });

  it("includes built-in nodes by default", () => {
    const registry = new NodeRegistry();
    expect(registry.hasNode("web_read")).toBe(true);
  });

  it("can add user-defined nodes", () => {
    const registry = new NodeRegistry({
      userNodes: { "custom.echo": customNode },
    });

    expect(registry.hasNode("custom.echo")).toBe(true);
    expect(registry.getNode("custom.echo")).toBe(customNode);
  });

  it("user nodes can override built-in nodes", () => {
    const overrideNode = Node.create({
      name: "web_read",
      description: "Overridden web_read",
      inputSchema: z.object({ url: z.string() }),
      execute: async () => ({ custom: true }),
    });

    const registry = new NodeRegistry({
      userNodes: { "web_read": overrideNode },
    });

    const node = registry.getNode("web_read");
    expect(node?.description).toBe("Overridden web_read");
  });

  it("getNode returns undefined for missing nodes", () => {
    const registry = new NodeRegistry();
    expect(registry.getNode("nonexistent")).toBeUndefined();
  });

  it("getNodes returns multiple nodes", () => {
    const registry = new NodeRegistry({
      userNodes: { "custom.echo": customNode },
    });

    const nodes = registry.getNodes(["web_read", "custom.echo"]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.name)).toContain("web_read");
    expect(nodes.map((n) => n.name)).toContain("custom.echo");
  });

  it("getNodes throws for missing nodes", () => {
    const registry = new NodeRegistry();
    expect(() => registry.getNodes(["web_read", "missing.node"])).toThrow(
      "Nodes not found: missing.node"
    );
  });

  it("listNodes returns all node names", () => {
    const registry = new NodeRegistry({
      userNodes: { "custom.echo": customNode },
    });

    const names = registry.listNodes();
    expect(names).toContain("web_read");
    expect(names).toContain("custom.echo");
  });
});
