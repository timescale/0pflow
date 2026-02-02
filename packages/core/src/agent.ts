// packages/core/src/agent.ts
import { z } from "zod";
import { DBOS } from "@dbos-inc/dbos-sdk";
import type { Executable, WorkflowContext, LogLevel } from "./types.js";
import { parseAgentSpec } from "./nodes/agent/parser.js";
import { executeAgent } from "./nodes/agent/executor.js";
import type { AgentTools } from "./nodes/agent/executor.js";
import type { ModelConfig } from "./nodes/agent/model-config.js";
import type { NodeRegistry } from "./nodes/registry.js";

export type { AgentTool, AgentTools } from "./nodes/agent/executor.js";

/**
 * Definition for creating an agent
 */
export interface AgentDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  /** Tools available to this agent, keyed by name */
  tools?: AgentTools;
  /** Path to agent spec markdown file (for system prompt) */
  specPath: string;
}

/**
 * Extended executable interface for agents
 */
export interface AgentExecutable<TInput = unknown, TOutput = unknown>
  extends Executable<TInput, TOutput> {
  readonly specPath: string;
  readonly tools: AgentTools;
}

/**
 * Runtime configuration for agent execution
 * Set by create0pflow() factory
 */
interface AgentRuntimeConfig {
  nodeRegistry: NodeRegistry;
  modelConfig?: ModelConfig;
}

let agentRuntimeConfig: AgentRuntimeConfig | null = null;

/**
 * Configure the agent runtime (called by factory)
 * @internal
 */
export function configureAgentRuntime(config: AgentRuntimeConfig): void {
  agentRuntimeConfig = config;
}

/**
 * Create a WorkflowContext for agent execution that wraps tool calls in DBOS steps
 */
function createAgentContext(): WorkflowContext {
  const ctx: WorkflowContext = {
    run: async <TInput, TOutput>(
      executable: Executable<TInput, TOutput>,
      inputs: TInput
    ): Promise<TOutput> => {
      // Validate inputs against schema
      const validated = executable.inputSchema.parse(inputs);

      // Wrap execution in DBOS step for durability
      return DBOS.runStep(
        async () => executable.execute(ctx, validated),
        { name: executable.name }
      );
    },

    log: (message: string, level: LogLevel = "info") => {
      DBOS.logger[level](message);
    },
  };

  return ctx;
}

/**
 * Factory for creating agent executables
 */
export const Agent = {
  create<TInput, TOutput = unknown>(
    definition: AgentDefinition<TInput, TOutput>
  ): AgentExecutable<TInput, TOutput> {
    const tools = definition.tools ?? {};

    // Create the DBOS-registered workflow function for this agent
    async function agentWorkflowImpl(inputs: TInput): Promise<TOutput> {
      if (!agentRuntimeConfig) {
        throw new Error(
          "Agent runtime not configured. Make sure to use create0pflow() before executing agents."
        );
      }

      const ctx = createAgentContext();

      // Parse the agent spec (for system prompt and model override)
      const spec = await parseAgentSpec(definition.specPath);

      // Convert inputs to a user message string
      // If inputs is a string, use directly; otherwise JSON stringify
      const userMessage =
        typeof inputs === "string" ? inputs : JSON.stringify(inputs, null, 2);

      // Execute the agent with tools from definition
      const result = await executeAgent({
        ctx,
        spec,
        userMessage,
        tools,
        nodeRegistry: agentRuntimeConfig.nodeRegistry,
        modelConfig: agentRuntimeConfig.modelConfig,
        outputSchema: definition.outputSchema,
      });

      return result.output as TOutput;
    }

    // Register as a DBOS workflow (agent runs as child workflow, tool calls are steps)
    const durableAgentWorkflow = DBOS.registerWorkflow(agentWorkflowImpl, {
      name: definition.name,
    });

    return {
      name: definition.name,
      type: "agent",
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      specPath: definition.specPath,
      tools,
      // execute ignores the ctx param and uses DBOS context instead
      execute: (_ctx: WorkflowContext, inputs: TInput) => durableAgentWorkflow(inputs),
    };
  },
};
