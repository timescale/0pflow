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
    <div className="h-screen w-screen flex bg-white">
      <div className="w-56 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-800">0pflow</h1>
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
            <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-sm border border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                {activeDag.workflowName}
              </span>
              <span className="text-xs text-gray-400 ml-2">
                v{activeDag.version}
              </span>
            </div>
          </ReactFlowProvider>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            {state.workflows.length === 0
              ? "No workflow files found. Create a workflow to get started."
              : "Select a workflow from the sidebar."}
          </div>
        )}
      </div>
    </div>
  );
}
