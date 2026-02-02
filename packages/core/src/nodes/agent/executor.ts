// packages/core/src/nodes/agent/executor.ts
import { generateText, tool, Output, stepCountIs } from "ai";
import { z } from "zod";
import type { AgentSpec } from "./parser.js";
import { createModelAndProvider, getDefaultModelConfig, parseModelString } from "./model-config.js";
import type { ModelConfig } from "./model-config.js";
import type { NodeRegistry } from "../registry.js";
import type { Executable, WorkflowContext } from "../../types.js";

/**
 * Result of agent execution
 */
export interface AgentExecutionResult<TOutput = unknown> {
  /** Final text response from the model */
  text: string;
  /** Parsed structured output (if outputSchema provided) */
  output: TOutput;
  /** Number of steps taken in the agentic loop */
  steps: number;
  /** Details of all tool calls made */
  toolCalls: Array<{
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyExecutable = Executable<any, any>;

/**
 * A provider tool from the AI SDK (e.g., openai.tools.webSearch()).
 * Using a minimal interface since ToolSet's type is overly restrictive.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProviderTool = { execute?: (...args: any[]) => any; [key: string]: unknown };

/**
 * A tool that can be passed to an agent.
 * Can be either a node (Executable) or a provider tool from AI SDK.
 */
export type AgentTool = AnyExecutable | ProviderTool;

/**
 * Tools available to an agent, keyed by tool name.
 */
export type AgentTools = Record<string, AgentTool>;

/**
 * Options for agent execution
 */
export interface ExecuteAgentOptions<TOutput = unknown> {
  /** Workflow context for tool execution */
  ctx: WorkflowContext;
  /** Parsed agent spec (for system prompt and model override) */
  spec: AgentSpec;
  /** User message / input to the agent */
  userMessage: string;
  /** Tools available to the agent, keyed by name */
  tools: AgentTools;
  /** Node registry (unused, kept for backward compatibility) */
  nodeRegistry: NodeRegistry;
  /** Optional model configuration override */
  modelConfig?: ModelConfig;
  /** Optional max steps override (defaults to spec.maxSteps or 10) */
  maxSteps?: number;
  /** Optional output schema for structured outputs */
  outputSchema?: z.ZodType<TOutput>;
}

/**
 * Check if a tool is an Executable (node) vs a CoreTool (provider tool).
 * Executables have a `type` property ("node", "agent", "workflow").
 */
function isExecutable(t: AgentTool): t is AnyExecutable {
  return (
    "type" in t &&
    typeof (t as AnyExecutable).type === "string" &&
    ["node", "agent", "workflow"].includes((t as AnyExecutable).type)
  );
}

/**
 * Convert an Executable to Vercel AI SDK tool format
 */
function convertNodeToAITool(executable: AnyExecutable, ctx: WorkflowContext) {
  return tool({
    description: executable.description,
    inputSchema: executable.inputSchema,
    execute: async (args: unknown) => {
      const result = await executable.execute(ctx, args);
      return result;
    },
  });
}

/**
 * Execute an agent with the given inputs
 *
 * Uses Vercel AI SDK's generateText with tool calling support.
 * Supports structured outputs when outputSchema is provided.
 */
export async function executeAgent<TOutput = unknown>(
  options: ExecuteAgentOptions<TOutput>
): Promise<AgentExecutionResult<TOutput>> {
  const {
    ctx,
    spec,
    userMessage,
    tools: inputTools,
    modelConfig: providedModelConfig,
    maxSteps: providedMaxSteps,
    outputSchema,
  } = options;

  // Resolve model configuration
  // Priority: spec.model > providedModelConfig > default
  let modelConfig = providedModelConfig ?? getDefaultModelConfig();
  if (spec.model) {
    const parsed = parseModelString(spec.model);
    modelConfig = {
      ...modelConfig,
      ...parsed,
    };
  }

  // Create the model instance
  const { model } = createModelAndProvider(modelConfig);

  // Convert tools to AI SDK tools
  // Don't annotate as ToolSet - let TypeScript infer so generateText's generics work
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  for (const [toolName, t] of Object.entries(inputTools)) {
    if (isExecutable(t)) {
      // It's a node - convert to AI SDK tool
      tools[toolName] = convertNodeToAITool(t, ctx);
    } else {
      // It's a provider tool - use directly
      tools[toolName] = t;
    }
  }

  // Determine max steps
  // Add 1 extra step for final output generation when using structured outputs
  const baseMaxSteps = providedMaxSteps ?? spec.maxSteps ?? 10;
  const maxSteps = outputSchema ? baseMaxSteps + 1 : baseMaxSteps;

  // Build the generateText options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateOptions: any = {
    model,
    system: spec.systemPrompt,
    prompt: userMessage,
    stopWhen: stepCountIs(maxSteps),
  };

  // Only add tools if we have any
  if (Object.keys(tools).length > 0) {
    generateOptions.tools = tools;
  }

  // Add output schema if provided
  if (outputSchema) {
    generateOptions.output = Output.object({ schema: outputSchema });
  }

  // Execute the agentic loop
  const result = await generateText(generateOptions);

  // Collect all tool calls from all steps
  const allToolCalls: AgentExecutionResult["toolCalls"] = [];
  for (const step of result.steps) {
    if (step.toolCalls) {
      for (const toolCall of step.toolCalls) {
        // Find the corresponding result
        const toolResult = step.toolResults?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r: any) => r.toolCallId === toolCall.toolCallId
        );
        allToolCalls.push({
          toolName: toolCall.toolName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args: (toolCall as any).input ?? (toolCall as any).args,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result: (toolResult as any)?.output ?? (toolResult as any)?.result,
        });
      }
    }
  }

  // Extract output
  // If we have an output schema, use the parsed object
  // Otherwise, use the text response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let output: any;
  if (outputSchema) {
    // The result.output contains the parsed structured output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output = (result as any).output;
  } else {
    // Try to parse JSON from the text response
    const text = result.text.trim();
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        output = JSON.parse(text);
      } catch {
        output = text;
      }
    } else {
      output = text;
    }
  }

  return {
    text: result.text,
    output,
    steps: result.steps.length,
    toolCalls: allToolCalls,
  };
}
