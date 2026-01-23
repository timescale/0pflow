import type { Workflow } from "./types.js";

export interface PflowConfig {
  workflowDir: string;
}

export interface Pflow {
  listWorkflows: () => Promise<string[]>;
  getWorkflow: (name: string) => Promise<Workflow | undefined>;
  triggerWorkflow: <T = unknown>(name: string, input: unknown) => Promise<T>;
}

/**
 * Create a 0pflow instance
 */
export async function create0pflow(_config: PflowConfig): Promise<Pflow> {
  // Placeholder implementation - will be completed in Phase 2
  return {
    listWorkflows: async () => [],
    getWorkflow: async () => undefined,
    triggerWorkflow: async () => {
      throw new Error("Not implemented");
    },
  };
}
