// packages/core/src/agent.ts
import { z } from "zod";
import type { Executable, WorkflowContext } from "./types.js";

/**
 * Definition for creating an agent
 */
export interface AgentDefinition<TInput, TOutput> {
  name: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  /** Path to agent spec markdown file */
  specPath: string;
}

/**
 * Extended executable interface for agents
 */
export interface AgentExecutable<TInput = unknown, TOutput = unknown>
  extends Executable<TInput, TOutput> {
  readonly specPath: string;
}

/**
 * Factory for creating agent executables (stub - Phase 3)
 */
export const Agent = {
  create<TInput, TOutput = unknown>(
    definition: AgentDefinition<TInput, TOutput>
  ): AgentExecutable<TInput, TOutput> {
    return {
      name: definition.name,
      type: "agent",
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      specPath: definition.specPath,
      execute: async (_ctx: WorkflowContext, _inputs: TInput): Promise<TOutput> => {
        throw new Error("Agent execution not implemented (Phase 3)");
      },
    };
  },
};
