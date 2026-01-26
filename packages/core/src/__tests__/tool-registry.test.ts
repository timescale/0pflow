// packages/core/src/__tests__/tool-registry.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../tools/registry.js";
import { Tool } from "../tools/tool.js";

describe("ToolRegistry", () => {
  const customTool = Tool.create({
    name: "custom.echo",
    description: "Echo input",
    inputSchema: z.object({ msg: z.string() }),
    execute: async ({ msg }) => msg,
  });

  it("includes built-in tools by default", () => {
    const registry = new ToolRegistry();
    expect(registry.hasTool("http.get")).toBe(true);
  });

  it("can add user-defined tools", () => {
    const registry = new ToolRegistry({
      userTools: { "custom.echo": customTool },
    });

    expect(registry.hasTool("custom.echo")).toBe(true);
    expect(registry.getTool("custom.echo")).toBe(customTool);
  });

  it("user tools can override built-in tools", () => {
    const overrideTool = Tool.create({
      name: "http.get",
      description: "Overridden http.get",
      inputSchema: z.object({ url: z.string() }),
      execute: async () => ({ custom: true }),
    });

    const registry = new ToolRegistry({
      userTools: { "http.get": overrideTool },
    });

    const tool = registry.getTool("http.get");
    expect(tool?.description).toBe("Overridden http.get");
  });

  it("getTool returns undefined for missing tools", () => {
    const registry = new ToolRegistry();
    expect(registry.getTool("nonexistent")).toBeUndefined();
  });

  it("getTools returns multiple tools", () => {
    const registry = new ToolRegistry({
      userTools: { "custom.echo": customTool },
    });

    const tools = registry.getTools(["http.get", "custom.echo"]);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toContain("http.get");
    expect(tools.map((t) => t.name)).toContain("custom.echo");
  });

  it("getTools throws for missing tools", () => {
    const registry = new ToolRegistry();
    expect(() => registry.getTools(["http.get", "missing.tool"])).toThrow(
      "Tools not found: missing.tool"
    );
  });

  it("listTools returns all tool names", () => {
    const registry = new ToolRegistry({
      userTools: { "custom.echo": customTool },
    });

    const names = registry.listTools();
    expect(names).toContain("http.get");
    expect(names).toContain("custom.echo");
  });
});
