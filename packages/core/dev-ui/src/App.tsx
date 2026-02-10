import { useState, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useDAGSocket } from "./hooks/useDAGSocket";
import { WorkflowGraph } from "./components/WorkflowGraph";
import { WorkflowSelector } from "./components/WorkflowSelector";

export function App() {
  const { state, connected } = useDAGSocket();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWorkflow && state.workflows.length > 0) {
      setSelectedWorkflow(state.workflows[0].workflowName);
    }
  }, [state.workflows, selectedWorkflow]);

  const activeDag = state.workflows.find(
    (w) => w.workflowName === selectedWorkflow,
  );

  return (
    <div className="h-screen w-screen flex bg-background">
      <div className="w-56 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h1 className="text-sm font-bold text-foreground font-serif">0pflow</h1>
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <WorkflowSelector
            workflows={state.workflows}
            parseErrors={state.parseErrors}
            selected={selectedWorkflow}
            onSelect={setSelectedWorkflow}
          />
        </div>
      </div>

      <div className="flex-1 relative">
        {activeDag ? (
          <ReactFlowProvider key={activeDag.workflowName}>
            <div className="absolute inset-0">
              <WorkflowGraph dag={activeDag} />
            </div>
            <div className="absolute top-3 left-3 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm border border-border">
              <span className="text-sm font-medium text-foreground">
                {activeDag.workflowName}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                v{activeDag.version}
              </span>
            </div>
          </ReactFlowProvider>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {state.workflows.length === 0
              ? "No workflow files found. Create a workflow to get started."
              : "Select a workflow from the sidebar."}
          </div>
        )}
      </div>
    </div>
  );
}
