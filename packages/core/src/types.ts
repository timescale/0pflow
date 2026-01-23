/**
 * Workflow definition interface
 */
export interface Workflow<TInput = unknown, TOutput = unknown> {
  name: string;
  version: number;
  run: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>;
}

/**
 * Node definition for function nodes
 */
export interface NodeDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  execute: (input: TInput) => Promise<TOutput>;
}

/**
 * Context passed to workflow run functions
 */
export interface WorkflowContext {
  /** Run an agent node */
  runAgent: <T = unknown>(name: string, input: unknown) => Promise<T>;
  /** Run a function node */
  runNode: <T = unknown>(name: string, input: unknown) => Promise<T>;
  /** Run a sub-workflow */
  runWorkflow: <T = unknown>(name: string, input: unknown) => Promise<T>;
  /** Call a built-in primitive */
  call: <T = unknown>(primitive: string, params: unknown) => Promise<T>;
  /** Log a message */
  log: (message: string, level?: "info" | "warn" | "error" | "debug") => void;
}
