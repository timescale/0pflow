import { useMemo, useRef, useLayoutEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DAGNode } from "../types";
import {
  generator,
  seedFromId,
  PENCIL,
  TYPE_ACCENT_COLORS,
  TYPE_BADGE_FILLS,
  TYPE_BADGE_TEXT,
} from "./roughHelpers";

type NodeType = DAGNode["type"];

const typeIcons: Record<NodeType, string> = {
  node: "fn",
  agent: "AI",
  workflow: "wf",
  input: "IN",
  output: "OUT",
  condition: "?",
};

export function WorkflowNode({ id, data }: NodeProps) {
  const nodeType = (data.type ?? "node") as NodeType;
  const label = (data.label ?? "") as string;
  const fields = (data.fields ?? undefined) as string[] | undefined;
  const icon = typeIcons[nodeType] ?? "fn";
  const isIO = nodeType === "input" || nodeType === "output";
  const isCondition = nodeType === "condition";

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: isIO ? 130 : 180, h: 46 });

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const { offsetWidth, offsetHeight } = containerRef.current;
    if (offsetWidth !== size.w || offsetHeight !== size.h) {
      setSize({ w: offsetWidth, h: offsetHeight });
    }
  });

  const seed = seedFromId(id);

  const roughSvg = useMemo(() => {
    const { w, h } = size;
    const borderStyle = isCondition ? PENCIL.conditionBorder : PENCIL.nodeBorder;

    const borderRect = generator.rectangle(0.5, 0.5, w - 1, h - 1, {
      ...borderStyle,
      seed,
    });

    const accentColor = TYPE_ACCENT_COLORS[nodeType] ?? "#a89f94";
    const accentLine = generator.line(4, 10, 4, h - 10, {
      ...PENCIL.accentLine,
      stroke: accentColor,
      seed: seed + 1,
    });

    const badgeFill = TYPE_BADGE_FILLS[nodeType] ?? "rgba(240, 235, 227, 0.8)";
    const badgeStroke = TYPE_BADGE_TEXT[nodeType] ?? "#a8a099";
    const badgeRect = generator.rectangle(20, 8, 28, 28, {
      ...PENCIL.badge,
      stroke: badgeStroke,
      fill: badgeFill,
      fillStyle: "solid",
      seed: seed + 2,
    });

    // Separator line for IO nodes with fields
    let separator: ReturnType<typeof generator.toPaths> | null = null;
    if (isIO && fields && fields.length > 0) {
      const sepLine = generator.line(14, 42, w - 10, 42, {
        roughness: 0.6,
        bowing: 0.3,
        strokeWidth: 0.7,
        stroke: "#d5cdc0",
        seed: seed + 3,
      });
      separator = generator.toPaths(sepLine);
    }

    return {
      border: generator.toPaths(borderRect),
      accent: generator.toPaths(accentLine),
      badge: generator.toPaths(badgeRect),
      separator,
    };
  }, [size, nodeType, isCondition, seed, isIO, fields]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ minWidth: isIO ? 120 : 160, maxWidth: 260 }}
    >
      {/* SVG sketch layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: "visible" }}
      >
        {roughSvg.border.map((p, i) => (
          <path
            key={`b${i}`}
            d={p.d}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
          />
        ))}
        {roughSvg.accent.map((p, i) => (
          <path
            key={`a${i}`}
            d={p.d}
            fill="none"
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
          />
        ))}
        {roughSvg.badge.map((p, i) => (
          <path
            key={`g${i}`}
            d={p.d}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
          />
        ))}
        {roughSvg.separator?.map((p, i) => (
          <path
            key={`s${i}`}
            d={p.d}
            fill="none"
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
          />
        ))}
      </svg>

      {/* Content layer */}
      <div className="flex items-center gap-2 px-3 py-2 pl-5 relative z-10">
        <div className="w-7 h-7 flex items-center justify-center shrink-0">
          <span
            className="text-[11px] font-bold font-sketch"
            style={{ color: TYPE_BADGE_TEXT[nodeType] }}
          >
            {icon}
          </span>
        </div>

        <span
          className={`font-sketch font-semibold ${
            isIO
              ? "text-[13px] text-muted-foreground"
              : "text-[15px] text-card-foreground"
          }`}
        >
          {label}
        </span>
      </div>

      {isIO && fields && fields.length > 0 && (
        <div className="px-3 py-1.5 pl-5 flex flex-wrap gap-x-2 gap-y-0.5 relative z-10">
          {fields.map((field) => (
            <span
              key={field}
              className="text-[11px] text-[#a8a099] font-sketch"
            >
              {field}
            </span>
          ))}
        </div>
      )}

      {/* Handles: tiny and subtle */}
      {nodeType !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-[5px] !h-[5px] !bg-[#c9c0b4] !border-0 !opacity-40"
        />
      )}
      {nodeType !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-[5px] !h-[5px] !bg-[#c9c0b4] !border-0 !opacity-40"
        />
      )}
    </div>
  );
}
