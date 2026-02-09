import { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode } from "./WorkflowNode";
import type { WorkflowDAG } from "../types";
import { computeLayout, NODE_WIDTH, NODE_HEIGHT } from "../layout";

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

interface WorkflowGraphProps {
  dag: WorkflowDAG;
}

export function WorkflowGraph({ dag }: WorkflowGraphProps) {
  const { fitView } = useReactFlow();

  const { flowNodes, flowEdges } = useMemo(() => {
    const positions = computeLayout(
      dag.nodes.map((n) => n.id),
      dag.edges.map((e) => ({ source: e.source, target: e.target })),
    );

    const flowNodes: Node[] = dag.nodes.map((node) => {
      const pos = positions.get(node.id) ?? { x: 0, y: 0 };
      return {
        id: node.id,
        type: "workflowNode",
        position: pos,
        data: { ...node },
        draggable: false,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });

    const flowEdges: Edge[] = dag.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: "#64748b" },
    }));

    return { flowNodes, flowEdges };
  }, [dag]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Sync React Flow state when the DAG updates (e.g. file change via WebSocket)
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [flowNodes, flowEdges, setNodes, setEdges, fitView]);

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onInit={onInit}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#e2e8f0" gap={16} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeStrokeWidth={3}
        pannable
        zoomable
        style={{ width: 120, height: 80 }}
      />
    </ReactFlow>
  );
}
