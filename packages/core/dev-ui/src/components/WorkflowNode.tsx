import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DAGNode } from "../types";

type NodeType = DAGNode["type"];

const typeStyles: Record<NodeType, { accent: string; iconBg: string }> = {
  node:      { accent: "bg-emerald-500", iconBg: "bg-emerald-50 text-emerald-600" },
  agent:     { accent: "bg-purple-500",  iconBg: "bg-purple-50 text-purple-600" },
  workflow:  { accent: "bg-emerald-500", iconBg: "bg-emerald-50 text-emerald-600" },
  input:     { accent: "bg-[#d4cfc8]",   iconBg: "bg-[#f5f3f0] text-[#a8a099]" },
  output:    { accent: "bg-[#d4cfc8]",   iconBg: "bg-[#f5f3f0] text-[#a8a099]" },
  condition: { accent: "bg-amber-400",   iconBg: "bg-amber-50 text-amber-600" },
};

const typeIcons: Record<NodeType, string> = {
  node: "fn",
  agent: "AI",
  workflow: "wf",
  input: "IN",
  output: "OUT",
  condition: "?",
};

export function WorkflowNode({ data }: NodeProps) {
  const nodeType = (data.type ?? "node") as NodeType;
  const label = (data.label ?? "") as string;
  const fields = (data.fields ?? undefined) as string[] | undefined;
  const style = typeStyles[nodeType] ?? typeStyles.node;
  const icon = typeIcons[nodeType] ?? "fn";
  const isIO = nodeType === "input" || nodeType === "output";
  const isCondition = nodeType === "condition";

  return (
    <div
      className={`
        bg-card border border-border rounded-lg shadow-sm relative
        ${isCondition ? "border-amber-200 border-dashed border-2" : ""}
      `}
      style={{ minWidth: isIO ? 120 : 160, maxWidth: 260 }}
    >
      <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${style.accent}`} />

      <div className="flex items-center gap-2 px-3 py-2 pl-4">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${style.iconBg}`}>
          <span className="text-[10px] font-bold">{icon}</span>
        </div>

        <span className={`font-medium ${isIO ? "text-xs text-muted-foreground" : "text-sm text-card-foreground"}`}>
          {label}
        </span>
      </div>

      {isIO && fields && fields.length > 0 && (
        <div className="border-t border-border px-3 py-1.5 pl-4 flex flex-wrap gap-x-2 gap-y-0.5">
          {fields.map((field) => (
            <span key={field} className="text-[10px] text-[#a8a099] font-mono">
              {field}
            </span>
          ))}
        </div>
      )}

      {nodeType !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-[#d4cfc8] !w-2 !h-2 !border-0"
        />
      )}
      {nodeType !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-[#d4cfc8] !w-2 !h-2 !border-0"
        />
      )}
    </div>
  );
}
