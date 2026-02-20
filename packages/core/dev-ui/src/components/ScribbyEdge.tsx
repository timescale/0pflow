import { useMemo } from "react";
import { getBezierPath, type EdgeProps } from "@xyflow/react";
import { generator, seedFromId, PENCIL } from "./roughHelpers";

export function ScribbyEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    markerEnd,
    label,
  } = props;

  const [bezierPath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const roughPaths = useMemo(() => {
    const drawable = generator.path(bezierPath, {
      ...PENCIL.edge,
      seed: seedFromId(id),
    });
    return generator.toPaths(drawable);
  }, [bezierPath, id]);

  return (
    <g>
      {/* Invisible fat path for interaction */}
      <path
        d={bezierPath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />
      {/* Rough.js pencil paths */}
      {roughPaths.map((pathInfo, i) => (
        <path
          key={i}
          d={pathInfo.d}
          fill="none"
          stroke={pathInfo.stroke}
          strokeWidth={pathInfo.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={i === roughPaths.length - 1 ? markerEnd : undefined}
        />
      ))}
      {/* Edge label */}
      {label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          className="react-flow__edge-text"
        >
          {label}
        </text>
      )}
    </g>
  );
}
