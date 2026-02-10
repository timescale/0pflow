export interface DAGNode {
  id: string;
  label: string;
  type: "node" | "agent" | "workflow" | "input" | "output" | "condition";
  /** The JS variable/identifier name (camelCase), used for code navigation */
  executableName?: string;
  /** The name from .create() config (kebab-case), used for runtime resolution */
  nodeName?: string;
  importPath?: string;
  lineNumber?: number;
  /** Schema field names for input/output nodes */
  fields?: string[];
  description?: string;
  integrations?: string[];
}

export interface LoopGroup {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDAG {
  workflowName: string;
  version: number;
  filePath: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  loopGroups?: LoopGroup[];
}

export interface ProjectDAGs {
  workflows: WorkflowDAG[];
  parseErrors: Array<{ filePath: string; error: string }>;
}
