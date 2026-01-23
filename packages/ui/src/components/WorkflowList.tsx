import type { ReactNode } from "react";

export interface WorkflowInfo {
  name: string;
  version: number;
}

export interface WorkflowListProps {
  workflows: WorkflowInfo[];
  renderItem?: (workflow: WorkflowInfo) => ReactNode;
}

/**
 * Displays a list of available workflows
 */
export function WorkflowList({ workflows, renderItem }: WorkflowListProps) {
  if (workflows.length === 0) {
    return <div>No workflows found</div>;
  }

  return (
    <ul>
      {workflows.map((workflow) => (
        <li key={workflow.name}>
          {renderItem
            ? renderItem(workflow)
            : `${workflow.name} (v${workflow.version})`}
        </li>
      ))}
    </ul>
  );
}
