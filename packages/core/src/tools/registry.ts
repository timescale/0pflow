// packages/core/src/tools/registry.ts
import type { ToolExecutable } from "./tool.js";
import { builtinTools } from "./builtin/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolExecutable = ToolExecutable<any, any>;

export interface ToolRegistryConfig {
  /** User-defined tools keyed by name */
  userTools?: Record<string, AnyToolExecutable>;
}

/**
 * Registry for resolving tools by name
 */
export class ToolRegistry {
  private tools: Map<string, AnyToolExecutable>;

  constructor(config: ToolRegistryConfig = {}) {
    this.tools = new Map();

    // Register built-in tools first
    for (const [name, tool] of Object.entries(builtinTools)) {
      this.tools.set(name, tool);
    }

    // Register user tools (can override built-ins if needed)
    for (const [name, tool] of Object.entries(config.userTools ?? {})) {
      this.tools.set(name, tool);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): AnyToolExecutable | undefined {
    return this.tools.get(name);
  }

  /**
   * Get multiple tools by name
   * @throws Error if any tool is not found
   */
  getTools(names: string[]): AnyToolExecutable[] {
    const tools: AnyToolExecutable[] = [];
    const missing: string[] = [];

    for (const name of names) {
      const tool = this.tools.get(name);
      if (tool) {
        tools.push(tool);
      } else {
        missing.push(name);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Tools not found: ${missing.join(", ")}`);
    }

    return tools;
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tool names
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
}
