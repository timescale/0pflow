import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { generator, seedFromId, PENCIL } from "./roughHelpers";

export function LoopGroupNode({ id, data }: NodeProps) {
  const label = (data.label ?? "") as string;
  const w = data.width as number;
  const h = data.height as number;

  const seed = seedFromId(id);

  const roughPaths = useMemo(() => {
    const rect = generator.rectangle(1, 1, w - 2, h - 2, {
      ...PENCIL.loopGroup,
      seed,
    });

    const headerLine = generator.line(8, 28, w - 8, 28, {
      roughness: 0.8,
      bowing: 0.3,
      strokeWidth: 0.8,
      stroke: "#b8ad9e",
      seed: seed + 1,
    });

    return {
      border: generator.toPaths(rect),
      headerLine: generator.toPaths(headerLine),
    };
  }, [w, h, seed]);

  return (
    <div className="relative" style={{ width: w, height: h }}>
      {/* SVG sketch layer */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: "visible" }}
      >
        {roughPaths.border.map((p, i) => (
          <path
            key={`b${i}`}
            d={p.d}
            fill={p.fill}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            strokeDasharray="8 5"
          />
        ))}
        {roughPaths.headerLine.map((p, i) => (
          <path
            key={`h${i}`}
            d={p.d}
            fill="none"
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeDasharray="6 4"
          />
        ))}
      </svg>

      {/* Header content */}
      <div className="flex items-center gap-1.5 px-3 py-1 relative z-10">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className="shrink-0 text-[#a8a099]"
        >
          <path
            d="M3 4C2 4 1 5 1 6.5C1 8 2 9 3 9H11C12 9 13 8 13 6.5C13 5 12 4 11 4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M9.5 3L11 4L9.5 5" fill="currentColor" />
        </svg>
        <span className="text-[12px] font-semibold text-muted-foreground truncate font-sketch">
          {label}
        </span>
      </div>

      {/* Invisible handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent !w-0 !h-0 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !w-0 !h-0 !border-0"
      />
    </div>
  );
}
